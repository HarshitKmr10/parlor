"""Persistence for workspace-scoped auto-tag rules.

Rules that auto-apply a meeting tag when a meeting's title matches a pattern.
Mirrors RedactionRulesRepo: workspace-scoped CRUD plus ``list_enabled`` for the
summarize pipeline.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

_COLS = (
    "id, workspace_id, pattern, match_type, tag_id, enabled, "
    "created_at, updated_at"
)


class AutoTagRulesRepo:
    def __init__(self, db) -> None:
        self._db = db

    async def list(self, workspace_id: str) -> List[Dict[str, Any]]:
        return await self._db.store.query_raw(
            f"SELECT {_COLS} FROM auto_tag_rules WHERE workspace_id = $1::uuid "
            f"ORDER BY created_at ASC",
            workspace_id,
        )

    async def list_enabled(self, workspace_id: str) -> List[Dict[str, Any]]:
        return await self._db.store.query_raw(
            f"SELECT {_COLS} FROM auto_tag_rules "
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
        tag_id: str,
    ) -> Dict[str, Any]:
        rows = await self._db.store.query_raw(
            f"""
            INSERT INTO auto_tag_rules
              (workspace_id, pattern, match_type, tag_id)
            VALUES ($1::uuid, $2, $3, $4::uuid)
            RETURNING {_COLS}
            """,
            workspace_id,
            pattern,
            match_type,
            tag_id,
        )
        return rows[0]

    async def update(
        self,
        *,
        rule_id: str,
        workspace_id: str,
        pattern: Optional[str],
        match_type: Optional[str],
        tag_id: Optional[str],
        enabled: Optional[bool],
    ) -> Optional[Dict[str, Any]]:
        rows = await self._db.store.query_raw(
            f"""
            UPDATE auto_tag_rules SET
              pattern = COALESCE($3, pattern),
              match_type = COALESCE($4, match_type),
              tag_id = COALESCE($5::uuid, tag_id),
              enabled = COALESCE($6, enabled),
              updated_at = now()
            WHERE id = $1::uuid AND workspace_id = $2::uuid
            RETURNING {_COLS}
            """,
            rule_id,
            workspace_id,
            pattern,
            match_type,
            tag_id,
            enabled,
        )
        return rows[0] if rows else None

    async def delete(self, *, rule_id: str, workspace_id: str) -> bool:
        rows = await self._db.store.query_raw(
            "DELETE FROM auto_tag_rules "
            "WHERE id = $1::uuid AND workspace_id = $2::uuid RETURNING id",
            rule_id,
            workspace_id,
        )
        return bool(rows)
