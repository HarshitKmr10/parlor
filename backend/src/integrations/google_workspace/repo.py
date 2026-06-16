"""Persistence for per-workspace Google Workspace org config.

Reads/writes ``google_workspace_orgs`` (one row per workspace, upserted on
POST). The service-account JSON is encrypted at rest with the same Fernet key
used for calendar tokens (``token_crypto``) and is NEVER returned to callers in
plaintext — :meth:`get_public` redacts it to a fingerprint.
"""

from __future__ import annotations

import hashlib
from typing import Any, Dict, Optional

from ...api.product.token_crypto import decrypt_token, encrypt_token
from .auth import AUTH_MODE_DWD, OrgAuthConfig

_PUBLIC_COLUMNS = (
    "id, workspace_id, domain, customer_id, auth_mode, "
    "delegated_admin_email, marketplace_client_id, marketplace_project_number, "
    "enabled, created_at, updated_at"
)


def _fingerprint(sa_json: Optional[str]) -> Optional[str]:
    """Short, non-reversible identifier for a service-account JSON.

    Lets the API confirm *which* SA is configured (and that one is) without
    ever exposing the key material.
    """
    if not sa_json:
        return None
    return hashlib.sha256(sa_json.encode("utf-8")).hexdigest()[:16]


class GoogleWorkspaceOrgRepo:
    def __init__(self, db) -> None:
        self._db = db

    async def get_public(self, workspace_id: str) -> Optional[Dict[str, Any]]:
        """Config WITHOUT the service-account JSON. Safe to return to clients.

        Adds a ``service_account_fingerprint`` so the dashboard can show that a
        key is configured without ever receiving it.
        """
        rows = await self._db.store.query_raw(
            f"SELECT {_PUBLIC_COLUMNS}, "
            "(service_account_json IS NOT NULL) AS has_service_account "
            "FROM google_workspace_orgs WHERE workspace_id = $1::uuid",
            workspace_id,
        )
        if not rows:
            return None
        row = dict(rows[0])
        # Compute the fingerprint from the decrypted SA JSON, then drop it.
        cipher = await self._raw_service_account_cipher(workspace_id)
        row["service_account_fingerprint"] = _fingerprint(decrypt_token(cipher))
        return row

    async def _raw_service_account_cipher(self, workspace_id: str) -> Optional[str]:
        rows = await self._db.store.query_raw(
            "SELECT service_account_json FROM google_workspace_orgs "
            "WHERE workspace_id = $1::uuid",
            workspace_id,
        )
        return dict(rows[0]).get("service_account_json") if rows else None

    async def get_auth_config(self, workspace_id: str) -> Optional[OrgAuthConfig]:
        """Decrypt + parse the config into an :class:`OrgAuthConfig`.

        Returns ``None`` when the workspace has no org configured. This is the
        bridge into the auth factory — callers do
        ``get_workspace_auth(await repo.get_auth_config(ws))``.
        """
        rows = await self._db.store.query_raw(
            "SELECT auth_mode, service_account_json, delegated_admin_email, "
            "domain, customer_id, marketplace_client_id, marketplace_project_number "
            "FROM google_workspace_orgs WHERE workspace_id = $1::uuid",
            workspace_id,
        )
        if not rows:
            return None
        row = dict(rows[0])
        sa_json = decrypt_token(row.get("service_account_json"))
        return OrgAuthConfig.from_service_account_json(
            sa_json,
            auth_mode=row.get("auth_mode") or AUTH_MODE_DWD,
            delegated_admin_email=row.get("delegated_admin_email"),
            domain=row.get("domain"),
            customer_id=row.get("customer_id"),
            marketplace_client_id=row.get("marketplace_client_id"),
            marketplace_project_number=row.get("marketplace_project_number"),
        )

    async def upsert(
        self,
        *,
        workspace_id: str,
        auth_mode: str,
        service_account_json: Optional[str],
        delegated_admin_email: Optional[str],
        domain: Optional[str],
        customer_id: Optional[str] = None,
        marketplace_client_id: Optional[str] = None,
        marketplace_project_number: Optional[str] = None,
        enabled: bool,
    ) -> Dict[str, Any]:
        """Upsert the org config (one row per workspace).

        The SA JSON is encrypted before it touches the DB. On update, a NULL
        ``service_account_json`` argument keeps the existing ciphertext (so an
        enable/disable toggle needn't re-upload the key).
        """
        encrypted = encrypt_token(service_account_json)
        rows = await self._db.store.query_raw(
            f"""
            INSERT INTO google_workspace_orgs
              (workspace_id, auth_mode, service_account_json,
               delegated_admin_email, domain, customer_id,
               marketplace_client_id, marketplace_project_number, enabled)
            VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (workspace_id) DO UPDATE
              SET auth_mode = EXCLUDED.auth_mode,
                  service_account_json = COALESCE(
                      EXCLUDED.service_account_json,
                      google_workspace_orgs.service_account_json),
                  delegated_admin_email = EXCLUDED.delegated_admin_email,
                  domain = EXCLUDED.domain,
                  customer_id = EXCLUDED.customer_id,
                  marketplace_client_id = EXCLUDED.marketplace_client_id,
                  marketplace_project_number = EXCLUDED.marketplace_project_number,
                  enabled = EXCLUDED.enabled,
                  updated_at = NOW()
            RETURNING {_PUBLIC_COLUMNS},
                      (service_account_json IS NOT NULL) AS has_service_account
            """,
            workspace_id,
            auth_mode,
            encrypted,
            delegated_admin_email,
            domain,
            customer_id,
            marketplace_client_id,
            marketplace_project_number,
            enabled,
        )
        row = dict(rows[0])
        cipher = await self._raw_service_account_cipher(workspace_id)
        row["service_account_fingerprint"] = _fingerprint(decrypt_token(cipher))
        return row

    async def delete(self, workspace_id: str) -> bool:
        rows = await self._db.store.query_raw(
            "DELETE FROM google_workspace_orgs WHERE workspace_id = $1::uuid "
            "RETURNING id",
            workspace_id,
        )
        return bool(rows)

    async def list_enabled(self) -> list[Dict[str, Any]]:
        """All enabled orgs (workspace_id + decrypted auth config attached).

        Used by the org-wide sync background loop. SA JSON stays in the
        in-memory :class:`OrgAuthConfig`; it is not surfaced raw.
        """
        rows = await self._db.store.query_raw(
            "SELECT workspace_id, auth_mode, service_account_json, "
            "delegated_admin_email, domain, customer_id, "
            "marketplace_client_id, marketplace_project_number "
            "FROM google_workspace_orgs WHERE enabled = TRUE"
        )
        out: list[Dict[str, Any]] = []
        for r in rows or []:
            d = dict(r)
            sa_json = decrypt_token(d.get("service_account_json"))
            out.append(
                {
                    "workspace_id": str(d.get("workspace_id")),
                    "auth_config": OrgAuthConfig.from_service_account_json(
                        sa_json,
                        auth_mode=d.get("auth_mode") or AUTH_MODE_DWD,
                        delegated_admin_email=d.get("delegated_admin_email"),
                        domain=d.get("domain"),
                        customer_id=d.get("customer_id"),
                        marketplace_client_id=d.get("marketplace_client_id"),
                        marketplace_project_number=d.get("marketplace_project_number"),
                    ),
                }
            )
        return out
