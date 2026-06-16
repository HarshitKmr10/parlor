"""Persistence for connected calendar accounts (tokens encrypted at rest)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from .token_crypto import decrypt_token, encrypt_token

UTC = timezone.utc


class CalendarRepo:
    def __init__(self, db) -> None:
        self._db = db

    async def list_for_workspace(self, workspace_id: str) -> List[Dict[str, Any]]:
        rows = await self._db.store.query_raw(
            "SELECT id, provider, email, auto_join, created_at "
            "FROM calendar_accounts WHERE workspace_id = $1::uuid "
            "ORDER BY created_at ASC",
            workspace_id,
        )
        return [dict(r) for r in (rows or [])]

    async def get_scoped(
        self, account_id: str, workspace_id: str
    ) -> Optional[Dict[str, Any]]:
        rows = await self._db.store.query_raw(
            "SELECT id, provider, email, auto_join, created_at "
            "FROM calendar_accounts WHERE id = $1::uuid AND workspace_id = $2::uuid",
            account_id,
            workspace_id,
        )
        return dict(rows[0]) if rows else None

    async def upsert(
        self,
        *,
        workspace_id: str,
        user_id: Optional[str],
        provider: str,
        email: str,
        access_token: Optional[str],
        refresh_token: Optional[str],
        expires_in: Optional[int],
    ) -> Dict[str, Any]:
        expires_at = (
            datetime.now(UTC) + timedelta(seconds=int(expires_in))
            if expires_in
            else None
        )
        rows = await self._db.store.query_raw(
            """
            INSERT INTO calendar_accounts
              (workspace_id, user_id, provider, email,
               access_token, refresh_token, expires_at)
            VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7)
            ON CONFLICT (workspace_id, provider, LOWER(email)) DO UPDATE
              SET access_token = EXCLUDED.access_token,
                  refresh_token = COALESCE(EXCLUDED.refresh_token,
                                           calendar_accounts.refresh_token),
                  expires_at = EXCLUDED.expires_at,
                  updated_at = NOW()
            RETURNING id, provider, email, auto_join, created_at
            """,
            workspace_id,
            user_id,
            provider,
            email,
            encrypt_token(access_token),
            encrypt_token(refresh_token),
            expires_at,
        )
        return dict(rows[0])

    async def set_auto_join(
        self, account_id: str, workspace_id: str, auto_join: bool
    ) -> Optional[Dict[str, Any]]:
        rows = await self._db.store.query_raw(
            """
            UPDATE calendar_accounts SET auto_join = $1, updated_at = NOW()
            WHERE id = $2::uuid AND workspace_id = $3::uuid
            RETURNING id, provider, email, auto_join, created_at
            """,
            auto_join,
            account_id,
            workspace_id,
        )
        return dict(rows[0]) if rows else None

    async def list_auto_join_accounts(self) -> List[Dict[str, Any]]:
        """All connected accounts with auto_join=true, tokens decrypted."""
        rows = await self._db.store.query_raw(
            "SELECT id, workspace_id, provider, email, "
            "access_token, refresh_token, expires_at "
            "FROM calendar_accounts WHERE auto_join = TRUE"
        )
        out: List[Dict[str, Any]] = []
        for r in rows or []:
            d = dict(r)
            d["access_token"] = decrypt_token(d.get("access_token"))
            d["refresh_token"] = decrypt_token(d.get("refresh_token"))
            out.append(d)
        return out
