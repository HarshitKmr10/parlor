"""Persistence for workspace-scoped capture exclusions (do-not-record rules).

Stores patterns that match a meeting's title or URL. When the calendar
auto-join poller (or any capture path) sees a match, it skips the meeting
entirely — Parlor never joins or records it. Fully local; workspace-scoped.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

_COLS = (
    "id, workspace_id, pattern, match_type, note, enabled, "
    "created_at, updated_at"
)


class CaptureExclusionsRepo:
    def __init__(self, db) -> None:
        self._db = db

    async def list(self, workspace_id: str) -> List[Dict[str, Any]]:
        return await self._db.store.query_raw(
            f"SELECT {_COLS} FROM capture_exclusions WHERE workspace_id = $1::uuid "
            f"ORDER BY created_at ASC",
            workspace_id,
        )

    async def list_enabled(self, workspace_id: str) -> List[Dict[str, Any]]:
        return await self._db.store.query_raw(
            f"SELECT {_COLS} FROM capture_exclusions "
            f"WHERE workspace_id = $1::uuid AND enabled = TRUE "
            f"ORDER BY created_at ASC",
            workspace_id,
        )

    async def create(
        self,
        *,
        workspace_id: str,
        pattern: str,
        match_type: str,
        note: Optional[str],
    ) -> Dict[str, Any]:
        rows = await self._db.store.query_raw(
            f"""
            INSERT INTO capture_exclusions
              (workspace_id, pattern, match_type, note)
            VALUES ($1::uuid, $2, $3, $4)
            RETURNING {_COLS}
            """,
            workspace_id,
            pattern,
            match_type,
            note,
        )
        return rows[0]

    async def update(
        self,
        *,
        exclusion_id: str,
        workspace_id: str,
        pattern: Optional[str],
        match_type: Optional[str],
        note: Optional[str],
        enabled: Optional[bool],
    ) -> Optional[Dict[str, Any]]:
        rows = await self._db.store.query_raw(
            f"""
            UPDATE capture_exclusions SET
              pattern = COALESCE($3, pattern),
              match_type = COALESCE($4, match_type),
              note = COALESCE($5, note),
              enabled = COALESCE($6, enabled),
              updated_at = now()
            WHERE id = $1::uuid AND workspace_id = $2::uuid
            RETURNING {_COLS}
            """,
            exclusion_id,
            workspace_id,
            pattern,
            match_type,
            note,
            enabled,
        )
        return rows[0] if rows else None

    async def delete(self, *, exclusion_id: str, workspace_id: str) -> bool:
        rows = await self._db.store.query_raw(
            "DELETE FROM capture_exclusions "
            "WHERE id = $1::uuid AND workspace_id = $2::uuid RETURNING id",
            exclusion_id,
            workspace_id,
        )
        return bool(rows)
