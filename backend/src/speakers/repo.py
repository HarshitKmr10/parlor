"""Persistence for workspace speaker profiles."""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Sequence

_COLS = "id, workspace_id, display_name, email, aliases, created_at, updated_at"


class SpeakerProfilesRepo:
    def __init__(self, db) -> None:
        self._db = db

    async def list(self, workspace_id: str) -> List[Dict[str, Any]]:
        return await self._db.store.query_raw(
            f"SELECT {_COLS} FROM speaker_profiles WHERE workspace_id = $1::uuid "
            f"ORDER BY display_name ASC",
            workspace_id,
        )

    async def create(
        self,
        *,
        workspace_id: str,
        display_name: str,
        email: Optional[str],
        aliases: Sequence[str],
    ) -> Dict[str, Any]:
        rows = await self._db.store.query_raw(
            f"""
            INSERT INTO speaker_profiles (workspace_id, display_name, email, aliases)
            VALUES ($1::uuid, $2, $3, $4::text[])
            RETURNING {_COLS}
            """,
            workspace_id,
            display_name,
            email,
            list(aliases),
        )
        return rows[0]

    async def update(
        self,
        *,
        profile_id: str,
        workspace_id: str,
        display_name: Optional[str],
        email: Optional[str],
        aliases: Optional[Sequence[str]],
    ) -> Optional[Dict[str, Any]]:
        rows = await self._db.store.query_raw(
            f"""
            UPDATE speaker_profiles SET
              display_name = COALESCE($3, display_name),
              email = COALESCE($4, email),
              aliases = COALESCE($5::text[], aliases),
              updated_at = now()
            WHERE id = $1::uuid AND workspace_id = $2::uuid
            RETURNING {_COLS}
            """,
            profile_id,
            workspace_id,
            display_name,
            email,
            list(aliases) if aliases is not None else None,
        )
        return rows[0] if rows else None

    async def delete(self, *, profile_id: str, workspace_id: str) -> bool:
        rows = await self._db.store.query_raw(
            "DELETE FROM speaker_profiles WHERE id = $1::uuid AND workspace_id = $2::uuid "
            "RETURNING id",
            profile_id,
            workspace_id,
        )
        return bool(rows)
