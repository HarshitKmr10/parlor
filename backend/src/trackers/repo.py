"""Persistence for trackers + their hits."""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Sequence

_T_COLS = "id, workspace_id, name, keywords, enabled, created_at, updated_at"
_H_COLS = (
    "id, tracker_id, workspace_id, meeting_id, matched_keyword, snippet, "
    "segment_id, t_start_sec, created_at"
)


class TrackersRepo:
    def __init__(self, db) -> None:
        self._db = db

    # ── trackers ──────────────────────────────────────────────────────────
    async def list(self, workspace_id: str) -> List[Dict[str, Any]]:
        return await self._db.store.query_raw(
            f"SELECT {_T_COLS} FROM trackers WHERE workspace_id = $1::uuid "
            f"ORDER BY created_at DESC",
            workspace_id,
        )

    async def list_enabled(self, workspace_id: str) -> List[Dict[str, Any]]:
        return await self._db.store.query_raw(
            f"SELECT {_T_COLS} FROM trackers "
            f"WHERE workspace_id = $1::uuid AND enabled = TRUE",
            workspace_id,
        )

    async def create(
        self, *, workspace_id: str, name: str, keywords: Sequence[str]
    ) -> Dict[str, Any]:
        rows = await self._db.store.query_raw(
            f"""
            INSERT INTO trackers (workspace_id, name, keywords)
            VALUES ($1::uuid, $2, $3::text[])
            RETURNING {_T_COLS}
            """,
            workspace_id,
            name,
            list(keywords),
        )
        return rows[0]

    async def update(
        self,
        *,
        tracker_id: str,
        workspace_id: str,
        name: Optional[str],
        keywords: Optional[Sequence[str]],
        enabled: Optional[bool],
    ) -> Optional[Dict[str, Any]]:
        rows = await self._db.store.query_raw(
            f"""
            UPDATE trackers SET
              name = COALESCE($3, name),
              keywords = COALESCE($4::text[], keywords),
              enabled = COALESCE($5, enabled),
              updated_at = now()
            WHERE id = $1::uuid AND workspace_id = $2::uuid
            RETURNING {_T_COLS}
            """,
            tracker_id,
            workspace_id,
            name,
            list(keywords) if keywords is not None else None,
            enabled,
        )
        return rows[0] if rows else None

    async def delete(self, *, tracker_id: str, workspace_id: str) -> bool:
        rows = await self._db.store.query_raw(
            "DELETE FROM trackers WHERE id = $1::uuid AND workspace_id = $2::uuid "
            "RETURNING id",
            tracker_id,
            workspace_id,
        )
        return bool(rows)

    # ── hits ──────────────────────────────────────────────────────────────
    async def record_hit(
        self,
        *,
        tracker_id: str,
        workspace_id: str,
        meeting_id: str,
        matched_keyword: str,
        snippet: str,
        segment_id: str,
        t_start_sec: float,
    ) -> bool:
        """Insert a hit; returns True if a NEW row was written (dedup-aware)."""
        rows = await self._db.store.query_raw(
            """
            INSERT INTO tracker_hits
              (tracker_id, workspace_id, meeting_id, matched_keyword, snippet,
               segment_id, t_start_sec)
            VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7)
            ON CONFLICT (tracker_id, meeting_id, segment_id, matched_keyword)
            DO NOTHING
            RETURNING id
            """,
            tracker_id,
            workspace_id,
            meeting_id,
            matched_keyword,
            snippet,
            segment_id,
            t_start_sec,
        )
        return bool(rows)

    async def list_hits(
        self, *, workspace_id: str, tracker_id: Optional[str] = None, limit: int = 100
    ) -> List[Dict[str, Any]]:
        if tracker_id:
            return await self._db.store.query_raw(
                f"SELECT {_H_COLS} FROM tracker_hits "
                f"WHERE workspace_id = $1::uuid AND tracker_id = $2::uuid "
                f"ORDER BY created_at DESC LIMIT $3",
                workspace_id,
                tracker_id,
                limit,
            )
        return await self._db.store.query_raw(
            f"SELECT {_H_COLS} FROM tracker_hits WHERE workspace_id = $1::uuid "
            f"ORDER BY created_at DESC LIMIT $2",
            workspace_id,
            limit,
        )
