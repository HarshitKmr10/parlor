"""Data access for the product auth/tenancy tables.

Thin async repository over the existing pluggable store's ``query_raw`` escape
hatch, so it works under both the pg (asyncpg) and prisma drivers. All queries
are parameterised. Returns plain dicts; routes map them to Pydantic models.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from ..database.connection import DatabaseConnection


class AuthRepository:
    """CRUD for users, workspaces, members, refresh tokens, and API keys."""

    def __init__(self, db: DatabaseConnection) -> None:
        self._db = db

    async def _query(self, sql: str, *params: Any) -> list[dict]:
        return await self._db.store.query_raw(sql, *params)

    async def _one(self, sql: str, *params: Any) -> Optional[dict]:
        rows = await self._query(sql, *params)
        return rows[0] if rows else None

    # ── users ──────────────────────────────────────────────────────────────
    async def get_user_by_email(self, email: str) -> Optional[dict]:
        return await self._one(
            "SELECT id, email, name, password_hash, created_at "
            "FROM users WHERE LOWER(email) = LOWER($1)",
            email,
        )

    async def get_user_by_id(self, user_id: str) -> Optional[dict]:
        return await self._one(
            "SELECT id, email, name, password_hash, created_at "
            "FROM users WHERE id = $1::uuid",
            user_id,
        )

    async def create_user(
        self, *, email: str, name: str, password_hash: str
    ) -> dict:
        row = await self._one(
            "INSERT INTO users (email, name, password_hash) "
            "VALUES ($1, $2, $3) "
            "RETURNING id, email, name, password_hash, created_at",
            email,
            name,
            password_hash,
        )
        assert row is not None
        return row

    # ── sso identities ───────────────────────────────────────────────────
    # Already-linked SSO accounts must be looked up by (issuer, subject), the
    # IdP's stable identifier — never by email, which is mutable at the IdP.
    async def get_user_by_sso_identity(
        self, *, issuer: str, subject: str
    ) -> Optional[dict]:
        return await self._one(
            "SELECT u.id, u.email, u.name, u.password_hash, u.created_at "
            "FROM users u "
            "JOIN sso_identities si ON si.user_id = u.id "
            "WHERE si.issuer = $1 AND si.subject = $2",
            issuer,
            subject,
        )

    async def link_sso_identity(
        self, *, user_id: str, issuer: str, subject: str, email: str
    ) -> None:
        await self._query(
            "INSERT INTO sso_identities (user_id, issuer, subject, email) "
            "VALUES ($1::uuid, $2, $3, $4) "
            "ON CONFLICT (issuer, subject) DO NOTHING",
            user_id,
            issuer,
            subject,
            email,
        )

    # ── workspaces ───────────────────────────────────────────────────────
    async def create_workspace(self, *, name: str, slug: str) -> dict:
        row = await self._one(
            "INSERT INTO workspaces (name, slug) VALUES ($1, $2) "
            "RETURNING id, name, slug, created_at",
            name,
            slug,
        )
        assert row is not None
        return row

    async def slug_exists(self, slug: str) -> bool:
        row = await self._one("SELECT 1 AS x FROM workspaces WHERE slug = $1", slug)
        return row is not None

    async def add_member(
        self, *, workspace_id: str, user_id: str, role: str
    ) -> None:
        await self._query(
            "INSERT INTO workspace_members (workspace_id, user_id, role) "
            "VALUES ($1::uuid, $2::uuid, $3) "
            "ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role",
            workspace_id,
            user_id,
            role,
        )

    async def list_workspaces_for_user(self, user_id: str) -> list[dict]:
        return await self._query(
            "SELECT w.id, w.name, w.slug, m.role "
            "FROM workspaces w "
            "JOIN workspace_members m ON m.workspace_id = w.id "
            "WHERE m.user_id = $1::uuid "
            "ORDER BY w.created_at ASC",
            user_id,
        )

    async def get_membership(
        self, *, workspace_id: str, user_id: str
    ) -> Optional[dict]:
        return await self._one(
            "SELECT w.id, w.name, w.slug, m.role "
            "FROM workspaces w "
            "JOIN workspace_members m ON m.workspace_id = w.id "
            "WHERE w.id = $1::uuid AND m.user_id = $2::uuid",
            workspace_id,
            user_id,
        )

    # ── refresh tokens ─────────────────────────────────────────────────────
    async def store_refresh_token(
        self, *, user_id: str, token_hash: str, expires_at: datetime
    ) -> None:
        await self._query(
            "INSERT INTO refresh_tokens (user_id, token_hash, expires_at) "
            "VALUES ($1::uuid, $2, $3)",
            user_id,
            token_hash,
            expires_at,
        )

    async def get_active_refresh_token(self, token_hash: str) -> Optional[dict]:
        return await self._one(
            "SELECT id, user_id, expires_at, revoked_at "
            "FROM refresh_tokens "
            "WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > NOW()",
            token_hash,
        )

    async def revoke_refresh_token(self, token_hash: str) -> None:
        await self._query(
            "UPDATE refresh_tokens SET revoked_at = NOW() "
            "WHERE token_hash = $1 AND revoked_at IS NULL",
            token_hash,
        )

    async def revoke_all_refresh_tokens(self, user_id: str) -> None:
        await self._query(
            "UPDATE refresh_tokens SET revoked_at = NOW() "
            "WHERE user_id = $1::uuid AND revoked_at IS NULL",
            user_id,
        )

    # ── api keys ───────────────────────────────────────────────────────────
    async def create_api_key(
        self, *, workspace_id: str, name: str, key_hash: str, prefix: str
    ) -> dict:
        row = await self._one(
            "INSERT INTO api_keys (workspace_id, name, key_hash, prefix) "
            "VALUES ($1::uuid, $2, $3, $4) "
            "RETURNING id, workspace_id, name, prefix, created_at, last_used_at",
            workspace_id,
            name,
            key_hash,
            prefix,
        )
        assert row is not None
        return row

    async def list_api_keys(self, workspace_id: str) -> list[dict]:
        return await self._query(
            "SELECT id, workspace_id, name, prefix, created_at, last_used_at "
            "FROM api_keys WHERE workspace_id = $1::uuid ORDER BY created_at DESC",
            workspace_id,
        )

    async def delete_api_key(self, *, workspace_id: str, key_id: str) -> bool:
        rows = await self._query(
            "DELETE FROM api_keys "
            "WHERE id = $1::uuid AND workspace_id = $2::uuid RETURNING id",
            key_id,
            workspace_id,
        )
        return bool(rows)

    async def get_api_key_by_hash(self, key_hash: str) -> Optional[dict]:
        return await self._one(
            "SELECT id, workspace_id, name, prefix FROM api_keys WHERE key_hash = $1",
            key_hash,
        )

    async def touch_api_key(self, key_id: str) -> None:
        await self._query(
            "UPDATE api_keys SET last_used_at = NOW() WHERE id = $1::uuid",
            key_id,
        )
