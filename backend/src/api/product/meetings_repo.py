"""Workspace-scoped meeting access for the product layer.

Reuses the internal MeetingService for create/dispatch/stop, but adds the
workspace_id scoping the contract requires. Scoped reads go through raw SQL
(via the store) because the internal list/count filter on org_id, not
workspace_id.
"""

from __future__ import annotations

from typing import Any, Optional

from ...db.python.schema import qualified_name
from ..database.connection import DatabaseConnection

_MEETING_TABLE_CACHE: Optional[str] = None


def _meeting_table(db: DatabaseConnection) -> str:
    # Honor MEETING_JOINER_SCHEMA in pg mode; bare table name under prisma.
    global _MEETING_TABLE_CACHE
    if _MEETING_TABLE_CACHE is not None:
        return _MEETING_TABLE_CACHE
    driver = getattr(db, "_driver", "pg")
    _MEETING_TABLE_CACHE = (
        qualified_name("meeting_joiner") if driver == "pg" else "meeting_joiner"
    )
    return _MEETING_TABLE_CACHE


# Status filter values exposed by the product API map onto internal statuses.
_PRODUCT_TO_INTERNAL_STATUS = {
    "scheduled": ("not_joined", "scheduled"),
    "joining": ("joining",),
    "ongoing": ("ongoing", "interrupted"),
    "completed": ("completed",),
    "failed": ("failed",),
}


class ProductMeetingsRepo:
    def __init__(self, db: DatabaseConnection) -> None:
        self._db = db

    async def set_workspace(self, meeting_id: str, workspace_id: str) -> None:
        table = _meeting_table(self._db)
        await self._db.store.query_raw(
            f"UPDATE {table} SET workspace_id = $1::uuid, updated_at = NOW() "
            f"WHERE id = $2::uuid",
            workspace_id,
            meeting_id,
        )

    async def set_title(self, meeting_id: str, title: str) -> None:
        table = _meeting_table(self._db)
        await self._db.store.query_raw(
            f"UPDATE {table} SET title = $1 WHERE id = $2::uuid",
            title,
            meeting_id,
        )

    async def get_scoped(
        self, meeting_id: str, workspace_id: str
    ) -> Optional[dict]:
        """Fetch a non-deleted meeting. Soft-deleted meetings 404 like they
        don't exist -- use `get_scoped_any` for restore/recovery flows that
        need to see tombstoned rows too."""
        table = _meeting_table(self._db)
        rows = await self._db.store.query_raw(
            f"SELECT id, title, insights FROM {table} "
            f"WHERE id = $1::uuid AND workspace_id = $2::uuid "
            f"AND deleted_at IS NULL",
            meeting_id,
            workspace_id,
        )
        return rows[0] if rows else None

    async def get_scoped_any(
        self, meeting_id: str, workspace_id: str
    ) -> Optional[dict]:
        """Like `get_scoped` but also returns soft-deleted rows."""
        table = _meeting_table(self._db)
        rows = await self._db.store.query_raw(
            f"SELECT id, title, insights, deleted_at FROM {table} "
            f"WHERE id = $1::uuid AND workspace_id = $2::uuid",
            meeting_id,
            workspace_id,
        )
        return rows[0] if rows else None

    async def get_scoped_many(
        self, meeting_ids: list[str], workspace_id: str
    ) -> dict[str, dict]:
        """Batch form of `get_scoped` -- returns a dict keyed by meeting id."""
        if not meeting_ids:
            return {}
        table = _meeting_table(self._db)
        rows = await self._db.store.query_raw(
            f"SELECT id, title, insights FROM {table} "
            f"WHERE id = ANY($1::uuid[]) AND workspace_id = $2::uuid "
            f"AND deleted_at IS NULL",
            meeting_ids,
            workspace_id,
        )
        return {str(row["id"]): row for row in rows}

    async def get_scoped_any_many(
        self, meeting_ids: list[str], workspace_id: str
    ) -> dict[str, dict]:
        """Batch form of `get_scoped_any` -- returns a dict keyed by meeting id."""
        if not meeting_ids:
            return {}
        table = _meeting_table(self._db)
        rows = await self._db.store.query_raw(
            f"SELECT id, title, insights, deleted_at FROM {table} "
            f"WHERE id = ANY($1::uuid[]) AND workspace_id = $2::uuid",
            meeting_ids,
            workspace_id,
        )
        return {str(row["id"]): row for row in rows}

    async def list_ids(
        self,
        *,
        workspace_id: str,
        statuses: Optional[list[str]],
        limit: int,
        offset: int,
        deleted: bool = False,
    ) -> list[str]:
        table = _meeting_table(self._db)
        clauses = [
            "workspace_id = $1::uuid",
            "deleted_at IS NOT NULL" if deleted else "deleted_at IS NULL",
        ]
        params: list[Any] = [workspace_id]
        if statuses:
            internal: list[str] = []
            for s in statuses:
                internal.extend(_PRODUCT_TO_INTERNAL_STATUS.get(s, ()))
            if internal:
                placeholders = ", ".join(
                    f"${i + 2}" for i in range(len(internal))
                )
                clauses.append(f"status IN ({placeholders})")
                params.extend(internal)
        params.append(limit)
        params.append(offset)
        order_col = "deleted_at" if deleted else "created_at"
        sql = (
            f"SELECT id FROM {table} WHERE {' AND '.join(clauses)} "
            f"ORDER BY {order_col} DESC LIMIT ${len(params) - 1} OFFSET ${len(params)}"
        )
        rows = await self._db.store.query_raw(sql, *params)
        return [str(r["id"]) for r in rows]

    async def count(
        self,
        *,
        workspace_id: str,
        statuses: Optional[list[str]],
        deleted: bool = False,
    ) -> int:
        table = _meeting_table(self._db)
        clauses = [
            "workspace_id = $1::uuid",
            "deleted_at IS NOT NULL" if deleted else "deleted_at IS NULL",
        ]
        params: list[Any] = [workspace_id]
        if statuses:
            internal: list[str] = []
            for s in statuses:
                internal.extend(_PRODUCT_TO_INTERNAL_STATUS.get(s, ()))
            if internal:
                placeholders = ", ".join(
                    f"${i + 2}" for i in range(len(internal))
                )
                clauses.append(f"status IN ({placeholders})")
                params.extend(internal)
        rows = await self._db.store.query_raw(
            f"SELECT COUNT(*) AS n FROM {table} WHERE {' AND '.join(clauses)}",
            *params,
        )
        return int(rows[0]["n"]) if rows else 0

    async def store_insights(self, meeting_id: str, insights: str) -> None:
        table = _meeting_table(self._db)
        await self._db.store.query_raw(
            f"UPDATE {table} SET insights = $1::jsonb, updated_at = NOW() "
            f"WHERE id = $2::uuid",
            insights,
            meeting_id,
        )
