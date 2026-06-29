"""Workspace-scoped persistence for action items + AI sync."""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Sequence

from .dedupe import dedupe_key

_COLS = (
    "id, workspace_id, meeting_id, created_by, text, assignee, due_date, done, "
    "source, created_at, updated_at"
)


class ActionItemsRepo:
    def __init__(self, db) -> None:
        self._db = db

    async def create(
        self,
        *,
        workspace_id: str,
        meeting_id: str,
        created_by: Optional[str],
        text: str,
        assignee: Optional[str],
        due_date: Optional[str],
        source: str = "manual",
    ) -> Dict[str, Any]:
        rows = await self._db.store.query_raw(
            f"""
            INSERT INTO action_items
              (workspace_id, meeting_id, created_by, text, dedupe_key,
               assignee, due_date, source)
            VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8)
            RETURNING {_COLS}
            """,
            workspace_id,
            meeting_id,
            created_by,
            text,
            dedupe_key(text),
            assignee,
            due_date,
            source,
        )
        return self._norm(rows[0])

    async def sync_ai_items(
        self, *, workspace_id: str, meeting_id: str, items: Sequence[Dict[str, str]]
    ) -> int:
        """Idempotently upsert AI items for a meeting. Returns rows inserted.

        ON CONFLICT DO NOTHING on (meeting_id, dedupe_key) preserves any user
        edits (done/assignee) made to an item from a prior summarization.
        """
        inserted = 0
        for it in items:
            rows = await self._db.store.query_raw(
                """
                INSERT INTO action_items
                  (workspace_id, meeting_id, text, dedupe_key, assignee,
                   due_date, source)
                VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, 'ai')
                ON CONFLICT (meeting_id, dedupe_key) WHERE source = 'ai'
                DO NOTHING
                RETURNING id
                """,
                workspace_id,
                meeting_id,
                it["text"],
                it["dedupe_key"],
                it.get("assignee"),
                it.get("due_date"),
            )
            if rows:
                inserted += 1
        return inserted

    async def list_for_meeting(
        self, meeting_id: str, workspace_id: str
    ) -> List[Dict[str, Any]]:
        rows = await self._db.store.query_raw(
            f"SELECT {_COLS} FROM action_items "
            f"WHERE meeting_id = $1::uuid AND workspace_id = $2::uuid "
            f"ORDER BY done ASC, created_at ASC",
            meeting_id,
            workspace_id,
        )
        return [self._norm(r) for r in (rows or [])]

    async def list_for_workspace(
        self,
        workspace_id: str,
        *,
        assignee: Optional[str],
        done: Optional[bool],
        limit: int,
        offset: int,
    ) -> List[Dict[str, Any]]:
        rows = await self._db.store.query_raw(
            f"""
            SELECT {_COLS} FROM action_items
            WHERE workspace_id = $1::uuid
              AND ($2::text IS NULL OR assignee = $2)
              AND ($3::bool IS NULL OR done = $3)
            ORDER BY done ASC, created_at DESC
            LIMIT $4 OFFSET $5
            """,
            workspace_id,
            assignee,
            done,
            limit,
            offset,
        )
        return [self._norm(r) for r in (rows or [])]

    async def get(self, item_id: str, workspace_id: str) -> Optional[Dict[str, Any]]:
        rows = await self._db.store.query_raw(
            f"SELECT {_COLS} FROM action_items "
            f"WHERE id = $1::uuid AND workspace_id = $2::uuid",
            item_id,
            workspace_id,
        )
        return self._norm(rows[0]) if rows else None

    async def update(
        self,
        *,
        item_id: str,
        workspace_id: str,
        text: Optional[str],
        assignee: Optional[str],
        due_date: Optional[str],
        done: Optional[bool],
    ) -> Optional[Dict[str, Any]]:
        rows = await self._db.store.query_raw(
            f"""
            UPDATE action_items SET
              text = COALESCE($3, text),
              dedupe_key = CASE WHEN $3 IS NULL THEN dedupe_key
                                ELSE md5(lower(btrim($3))) END,
              assignee = COALESCE($4, assignee),
              due_date = COALESCE($5, due_date),
              done = COALESCE($6, done),
              updated_at = NOW()
            WHERE id = $1::uuid AND workspace_id = $2::uuid
            RETURNING {_COLS}
            """,
            item_id,
            workspace_id,
            text,
            assignee,
            due_date,
            done,
        )
        return self._norm(rows[0]) if rows else None

    async def delete(self, item_id: str, workspace_id: str) -> bool:
        rows = await self._db.store.query_raw(
            "DELETE FROM action_items "
            "WHERE id = $1::uuid AND workspace_id = $2::uuid RETURNING id",
            item_id,
            workspace_id,
        )
        return bool(rows)

    @staticmethod
    def _norm(row: Dict[str, Any]) -> Dict[str, Any]:
        out = dict(row)
        for key in ("id", "workspace_id", "meeting_id", "created_by"):
            if out.get(key) is not None:
                out[key] = str(out[key])
        return out
