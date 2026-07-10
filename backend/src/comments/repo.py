"""Workspace-scoped persistence for meeting comments + member resolution.

Every read/write is scoped by ``workspace_id``. Mention targets are filtered to
actual workspace members (:meth:`filter_members`) before storage, and author /
mention display names are resolved in batch (:meth:`names_for`) so the route
never N+1s over users.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Sequence

_COLS = (
    "id, meeting_id, workspace_id, author_id, parent_id, body, anchor_t_sec, "
    "anchor_segment_id, mentioned_user_ids, resolved, edited, created_at, "
    "updated_at"
)


class CommentsRepo:
    def __init__(self, db) -> None:
        self._db = db

    async def filter_members(
        self, workspace_id: str, user_ids: Sequence[str]
    ) -> List[str]:
        """Return the subset of ``user_ids`` that are members of the workspace."""
        if not user_ids:
            return []
        rows = await self._db.store.query_raw(
            "SELECT user_id FROM workspace_members "
            "WHERE workspace_id = $1::uuid AND user_id = ANY($2::uuid[])",
            workspace_id,
            list(dict.fromkeys(user_ids)),  # dedupe, preserve order
        )
        return [str(r["user_id"]) for r in (rows or [])]

    async def names_for(self, user_ids: Sequence[str]) -> Dict[str, str]:
        """Map user_id → display name for the given ids (members or not)."""
        ids = [u for u in dict.fromkeys(user_ids) if u]
        if not ids:
            return {}
        rows = await self._db.store.query_raw(
            "SELECT id, name FROM users WHERE id = ANY($1::uuid[])",
            ids,
        )
        return {str(r["id"]): r["name"] for r in (rows or [])}

    async def create(
        self,
        *,
        meeting_id: str,
        workspace_id: str,
        author_id: Optional[str],
        parent_id: Optional[str],
        body: str,
        anchor_t_sec: Optional[float],
        anchor_segment_id: Optional[str],
        mentioned_user_ids: Sequence[str],
    ) -> Dict[str, Any]:
        rows = await self._db.store.query_raw(
            f"""
            INSERT INTO meeting_comments
              (meeting_id, workspace_id, author_id, parent_id, body,
               anchor_t_sec, anchor_segment_id, mentioned_user_ids)
            VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6, $7, $8::uuid[])
            RETURNING {_COLS}
            """,
            meeting_id,
            workspace_id,
            author_id,
            parent_id,
            body,
            anchor_t_sec,
            anchor_segment_id,
            list(mentioned_user_ids),
        )
        return self._normalize(rows[0])

    async def list_for_meeting(
        self,
        meeting_id: str,
        workspace_id: str,
        *,
        limit: int = 100,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        rows = await self._db.store.query_raw(
            f"SELECT {_COLS} FROM meeting_comments "
            f"WHERE meeting_id = $1::uuid AND workspace_id = $2::uuid "
            f"ORDER BY created_at ASC "
            f"LIMIT $3 OFFSET $4",
            meeting_id,
            workspace_id,
            limit,
            offset,
        )
        return [self._normalize(r) for r in (rows or [])]

    async def get(self, comment_id: str, workspace_id: str) -> Optional[Dict[str, Any]]:
        rows = await self._db.store.query_raw(
            f"SELECT {_COLS} FROM meeting_comments "
            f"WHERE id = $1::uuid AND workspace_id = $2::uuid",
            comment_id,
            workspace_id,
        )
        return self._normalize(rows[0]) if rows else None

    async def update_body(
        self,
        *,
        comment_id: str,
        workspace_id: str,
        body: str,
        mentioned_user_ids: Sequence[str],
    ) -> Optional[Dict[str, Any]]:
        rows = await self._db.store.query_raw(
            f"""
            UPDATE meeting_comments SET
              body = $3,
              mentioned_user_ids = $4::uuid[],
              edited = TRUE,
              updated_at = NOW()
            WHERE id = $1::uuid AND workspace_id = $2::uuid
            RETURNING {_COLS}
            """,
            comment_id,
            workspace_id,
            body,
            list(mentioned_user_ids),
        )
        return self._normalize(rows[0]) if rows else None

    async def set_resolved(
        self, *, comment_id: str, workspace_id: str, resolved: bool
    ) -> Optional[Dict[str, Any]]:
        rows = await self._db.store.query_raw(
            f"UPDATE meeting_comments SET resolved = $3, updated_at = NOW() "
            f"WHERE id = $1::uuid AND workspace_id = $2::uuid RETURNING {_COLS}",
            comment_id,
            workspace_id,
            resolved,
        )
        return self._normalize(rows[0]) if rows else None

    async def delete(self, comment_id: str, workspace_id: str) -> bool:
        rows = await self._db.store.query_raw(
            "DELETE FROM meeting_comments "
            "WHERE id = $1::uuid AND workspace_id = $2::uuid RETURNING id",
            comment_id,
            workspace_id,
        )
        return bool(rows)

    @staticmethod
    def _normalize(row: Dict[str, Any]) -> Dict[str, Any]:
        out = dict(row)
        for key in ("id", "meeting_id", "workspace_id", "author_id", "parent_id"):
            if out.get(key) is not None:
                out[key] = str(out[key])
        out["mentioned_user_ids"] = [
            str(u) for u in (out.get("mentioned_user_ids") or [])
        ]
        return out
