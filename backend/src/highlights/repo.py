"""Workspace-scoped persistence for meeting highlights.

Reads/writes the ``meeting_highlights`` table. Every query is scoped by
``workspace_id`` so one workspace can never read or mutate another's clips.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

_COLS = (
    "id, meeting_id, workspace_id, created_by, t_start_sec, t_end_sec, "
    "label, note, color, excerpt, created_at, updated_at"
)


class HighlightsRepo:
    def __init__(self, db) -> None:
        self._db = db

    async def create(
        self,
        *,
        meeting_id: str,
        workspace_id: str,
        created_by: Optional[str],
        t_start_sec: float,
        t_end_sec: float,
        label: Optional[str],
        note: Optional[str],
        color: Optional[str],
        excerpt: Optional[str],
    ) -> Dict[str, Any]:
        rows = await self._db.store.query_raw(
            f"""
            INSERT INTO meeting_highlights
              (meeting_id, workspace_id, created_by, t_start_sec, t_end_sec,
               label, note, color, excerpt)
            VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9)
            RETURNING {_COLS}
            """,
            meeting_id,
            workspace_id,
            created_by,
            t_start_sec,
            t_end_sec,
            label,
            note,
            color,
            excerpt,
        )
        return self._normalize(rows[0])

    async def list_for_meeting(
        self, meeting_id: str, workspace_id: str
    ) -> List[Dict[str, Any]]:
        rows = await self._db.store.query_raw(
            f"SELECT {_COLS} FROM meeting_highlights "
            f"WHERE meeting_id = $1::uuid AND workspace_id = $2::uuid "
            f"ORDER BY t_start_sec ASC",
            meeting_id,
            workspace_id,
        )
        return [self._normalize(r) for r in (rows or [])]

    async def get(
        self, highlight_id: str, workspace_id: str
    ) -> Optional[Dict[str, Any]]:
        rows = await self._db.store.query_raw(
            f"SELECT {_COLS} FROM meeting_highlights "
            f"WHERE id = $1::uuid AND workspace_id = $2::uuid",
            highlight_id,
            workspace_id,
        )
        return self._normalize(rows[0]) if rows else None

    async def update(
        self,
        *,
        highlight_id: str,
        workspace_id: str,
        t_start_sec: Optional[float],
        t_end_sec: Optional[float],
        label: Optional[str],
        note: Optional[str],
        color: Optional[str],
        excerpt: Optional[str],
    ) -> Optional[Dict[str, Any]]:
        """Patch provided fields; ``None`` means leave unchanged (COALESCE)."""
        rows = await self._db.store.query_raw(
            f"""
            UPDATE meeting_highlights SET
              t_start_sec = COALESCE($3, t_start_sec),
              t_end_sec   = COALESCE($4, t_end_sec),
              label       = COALESCE($5, label),
              note        = COALESCE($6, note),
              color       = COALESCE($7, color),
              excerpt     = COALESCE($8, excerpt),
              updated_at  = NOW()
            WHERE id = $1::uuid AND workspace_id = $2::uuid
            RETURNING {_COLS}
            """,
            highlight_id,
            workspace_id,
            t_start_sec,
            t_end_sec,
            label,
            note,
            color,
            excerpt,
        )
        return self._normalize(rows[0]) if rows else None

    async def delete(self, highlight_id: str, workspace_id: str) -> bool:
        rows = await self._db.store.query_raw(
            "DELETE FROM meeting_highlights "
            "WHERE id = $1::uuid AND workspace_id = $2::uuid RETURNING id",
            highlight_id,
            workspace_id,
        )
        return bool(rows)

    async def list_for_workspace(
        self, workspace_id: str, *, limit: int, offset: int
    ) -> List[Dict[str, Any]]:
        """Cross-meeting highlights reel, newest first, with meeting title."""
        from ..api.product.meetings_repo import _meeting_table  # noqa: PLC0415

        table = _meeting_table(self._db)
        rows = await self._db.store.query_raw(
            f"""
            SELECT h.id, h.meeting_id, h.workspace_id, h.created_by,
                   h.t_start_sec, h.t_end_sec, h.label, h.note, h.color,
                   h.excerpt, h.created_at, h.updated_at, m.title AS meeting_title
            FROM meeting_highlights h
            LEFT JOIN {table} m ON m.id = h.meeting_id
            WHERE h.workspace_id = $1::uuid
              AND (m.deleted_at IS NULL)
            ORDER BY h.created_at DESC
            LIMIT $2 OFFSET $3
            """,
            workspace_id,
            limit,
            offset,
        )
        return [self._normalize(r) for r in (rows or [])]

    async def count_for_workspace(self, workspace_id: str) -> int:
        from ..api.product.meetings_repo import _meeting_table  # noqa: PLC0415

        table = _meeting_table(self._db)
        rows = await self._db.store.query_raw(
            f"""
            SELECT COUNT(*) AS n FROM meeting_highlights h
            LEFT JOIN {table} m ON m.id = h.meeting_id
            WHERE h.workspace_id = $1::uuid
              AND (m.deleted_at IS NULL)
            """,
            workspace_id,
        )
        return int(rows[0]["n"]) if rows else 0

    @staticmethod
    def _normalize(row: Dict[str, Any]) -> Dict[str, Any]:
        out = dict(row)
        for key in ("id", "meeting_id", "workspace_id", "created_by"):
            if out.get(key) is not None:
                out[key] = str(out[key])
        return out
