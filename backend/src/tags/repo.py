"""Persistence for meeting tags + their per-meeting assignments."""

from __future__ import annotations

from typing import Any, Dict, List, Sequence

_COLS = "id, workspace_id, name, color, created_at"


class TagsRepo:
    def __init__(self, db) -> None:
        self._db = db

    # ── tag definitions ───────────────────────────────────────────────────
    async def list(self, workspace_id: str) -> List[Dict[str, Any]]:
        return await self._db.store.query_raw(
            f"SELECT {_COLS} FROM tags WHERE workspace_id = $1::uuid "
            f"ORDER BY created_at DESC",
            workspace_id,
        )

    async def create(
        self, *, workspace_id: str, name: str, color: str
    ) -> Dict[str, Any]:
        rows = await self._db.store.query_raw(
            f"""
            INSERT INTO tags (workspace_id, name, color)
            VALUES ($1::uuid, $2, $3)
            RETURNING {_COLS}
            """,
            workspace_id,
            name,
            color,
        )
        return rows[0]

    async def delete(self, *, tag_id: str, workspace_id: str) -> bool:
        rows = await self._db.store.query_raw(
            "DELETE FROM tags WHERE id = $1::uuid AND workspace_id = $2::uuid "
            "RETURNING id",
            tag_id,
            workspace_id,
        )
        return bool(rows)

    # ── per-meeting assignments ───────────────────────────────────────────
    async def list_for_meeting(
        self, meeting_id: str, workspace_id: str
    ) -> List[Dict[str, Any]]:
        return await self._db.store.query_raw(
            f"""
            SELECT t.id, t.workspace_id, t.name, t.color, t.created_at
            FROM meeting_tags mt
            JOIN tags t ON t.id = mt.tag_id
            WHERE mt.meeting_id = $1::uuid AND mt.workspace_id = $2::uuid
            ORDER BY t.name ASC
            """,
            meeting_id,
            workspace_id,
        )

    async def set_for_meeting(
        self, meeting_id: str, workspace_id: str, tag_ids: Sequence[str]
    ) -> List[Dict[str, Any]]:
        """Replace a meeting's tags with the given tag_ids (workspace-scoped).

        Deletes existing rows for the meeting, then inserts the given tag_ids
        that actually belong to the workspace. Returns the resulting tag rows.
        """
        await self._db.store.query_raw(
            "DELETE FROM meeting_tags "
            "WHERE meeting_id = $1::uuid AND workspace_id = $2::uuid",
            meeting_id,
            workspace_id,
        )
        unique_ids = list(dict.fromkeys(str(t) for t in tag_ids if str(t).strip()))
        if unique_ids:
            await self._db.store.query_raw(
                """
                INSERT INTO meeting_tags (meeting_id, tag_id, workspace_id)
                SELECT $1::uuid, t.id, $2::uuid
                FROM tags t
                WHERE t.workspace_id = $2::uuid
                  AND t.id = ANY($3::uuid[])
                ON CONFLICT (meeting_id, tag_id) DO NOTHING
                """,
                meeting_id,
                workspace_id,
                unique_ids,
            )
        return await self.list_for_meeting(meeting_id, workspace_id)
