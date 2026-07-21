"""Persistence for private, per-user meeting notes."""

from __future__ import annotations

from typing import Any, Dict

_COLS = "body, updated_at"


class MeetingNotesRepo:
    def __init__(self, db) -> None:
        self._db = db

    async def get(
        self, workspace_id: str, user_id: str, meeting_id: str
    ) -> Dict[str, Any]:
        rows = await self._db.store.query_raw(
            f"""
            SELECT {_COLS} FROM meeting_notes
            WHERE workspace_id = $1::uuid
              AND user_id = $2::uuid
              AND meeting_id = $3::uuid
            """,
            workspace_id,
            user_id,
            meeting_id,
        )
        return rows[0] if rows else {"body": ""}

    async def upsert(
        self, *, workspace_id: str, user_id: str, meeting_id: str, body: str
    ) -> Dict[str, Any]:
        rows = await self._db.store.query_raw(
            f"""
            INSERT INTO meeting_notes (workspace_id, user_id, meeting_id, body)
            VALUES ($1::uuid, $2::uuid, $3::uuid, $4)
            ON CONFLICT (user_id, meeting_id) DO UPDATE SET
              body = EXCLUDED.body,
              workspace_id = EXCLUDED.workspace_id,
              updated_at = now()
            RETURNING {_COLS}
            """,
            workspace_id,
            user_id,
            meeting_id,
            body,
        )
        return rows[0]
