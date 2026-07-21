"""Persistence for workspace-scoped saved views (named searches)."""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

_COLS = "id, workspace_id, name, query, filters, created_at, updated_at"


class SavedViewsRepo:
    def __init__(self, db) -> None:
        self._db = db

    async def list(self, workspace_id: str) -> List[Dict[str, Any]]:
        return await self._db.store.query_raw(
            f"SELECT {_COLS} FROM saved_views WHERE workspace_id = $1::uuid "
            f"ORDER BY created_at DESC",
            workspace_id,
        )

    async def create(
        self,
        *,
        workspace_id: str,
        name: str,
        query: str,
        filters: Dict[str, Any],
    ) -> Dict[str, Any]:
        rows = await self._db.store.query_raw(
            f"""
            INSERT INTO saved_views (workspace_id, name, query, filters)
            VALUES ($1::uuid, $2, $3, $4::jsonb)
            RETURNING {_COLS}
            """,
            workspace_id,
            name,
            query,
            json.dumps(filters or {}),
        )
        return rows[0]

    async def update(
        self,
        *,
        view_id: str,
        workspace_id: str,
        name: Optional[str],
        query: Optional[str],
        filters: Optional[Dict[str, Any]],
    ) -> Optional[Dict[str, Any]]:
        rows = await self._db.store.query_raw(
            f"""
            UPDATE saved_views SET
              name = COALESCE($3, name),
              query = COALESCE($4, query),
              filters = COALESCE($5::jsonb, filters),
              updated_at = now()
            WHERE id = $1::uuid AND workspace_id = $2::uuid
            RETURNING {_COLS}
            """,
            view_id,
            workspace_id,
            name,
            query,
            json.dumps(filters) if filters is not None else None,
        )
        return rows[0] if rows else None

    async def delete(self, *, view_id: str, workspace_id: str) -> bool:
        rows = await self._db.store.query_raw(
            "DELETE FROM saved_views "
            "WHERE id = $1::uuid AND workspace_id = $2::uuid RETURNING id",
            view_id,
            workspace_id,
        )
        return bool(rows)
