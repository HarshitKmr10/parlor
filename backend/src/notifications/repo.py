"""Workspace + user scoped persistence for notifications."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

_COLS = (
    "id, workspace_id, user_id, type, title, body, link, meeting_id, "
    "actor_id, read, created_at"
)


class NotificationsRepo:
    def __init__(self, db) -> None:
        self._db = db

    async def create(
        self,
        *,
        workspace_id: str,
        user_id: str,
        type: str,
        title: str,
        body: Optional[str] = None,
        link: Optional[str] = None,
        meeting_id: Optional[str] = None,
        actor_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        rows = await self._db.store.query_raw(
            f"""
            INSERT INTO notifications
              (workspace_id, user_id, type, title, body, link, meeting_id, actor_id)
            VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7::uuid, $8::uuid)
            RETURNING {_COLS}
            """,
            workspace_id,
            user_id,
            type,
            title,
            body,
            link,
            meeting_id,
            actor_id,
        )
        return rows[0]

    async def list_for_user(
        self,
        *,
        workspace_id: str,
        user_id: str,
        limit: int = 50,
        unread_only: bool = False,
    ) -> List[Dict[str, Any]]:
        clause = "workspace_id = $1::uuid AND user_id = $2::uuid"
        if unread_only:
            clause += " AND read = FALSE"
        return await self._db.store.query_raw(
            f"SELECT {_COLS} FROM notifications WHERE {clause} "
            f"ORDER BY created_at DESC LIMIT $3",
            workspace_id,
            user_id,
            limit,
        )

    async def unread_count(self, *, workspace_id: str, user_id: str) -> int:
        rows = await self._db.store.query_raw(
            "SELECT count(*) AS n FROM notifications "
            "WHERE workspace_id = $1::uuid AND user_id = $2::uuid AND read = FALSE",
            workspace_id,
            user_id,
        )
        return int(rows[0]["n"]) if rows else 0

    async def mark_read(
        self, *, notification_id: str, workspace_id: str, user_id: str
    ) -> bool:
        rows = await self._db.store.query_raw(
            "UPDATE notifications SET read = TRUE "
            "WHERE id = $1::uuid AND workspace_id = $2::uuid AND user_id = $3::uuid "
            "RETURNING id",
            notification_id,
            workspace_id,
            user_id,
        )
        return bool(rows)

    async def mark_all_read(self, *, workspace_id: str, user_id: str) -> int:
        rows = await self._db.store.query_raw(
            "UPDATE notifications SET read = TRUE "
            "WHERE workspace_id = $1::uuid AND user_id = $2::uuid AND read = FALSE "
            "RETURNING id",
            workspace_id,
            user_id,
        )
        return len(rows)
