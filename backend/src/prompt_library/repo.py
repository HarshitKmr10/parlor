"""Persistence for workspace-scoped saved Ask prompts."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

_COLS = "id, workspace_id, title, body, created_at, updated_at"


class SavedPromptsRepo:
    def __init__(self, db) -> None:
        self._db = db

    async def list(self, workspace_id: str) -> List[Dict[str, Any]]:
        return await self._db.store.query_raw(
            f"SELECT {_COLS} FROM saved_prompts WHERE workspace_id = $1::uuid "
            f"ORDER BY created_at DESC",
            workspace_id,
        )

    async def create(
        self,
        *,
        workspace_id: str,
        title: str,
        body: str,
    ) -> Dict[str, Any]:
        rows = await self._db.store.query_raw(
            f"""
            INSERT INTO saved_prompts (workspace_id, title, body)
            VALUES ($1::uuid, $2, $3)
            RETURNING {_COLS}
            """,
            workspace_id,
            title,
            body,
        )
        return rows[0]

    async def update(
        self,
        *,
        prompt_id: str,
        workspace_id: str,
        title: Optional[str],
        body: Optional[str],
    ) -> Optional[Dict[str, Any]]:
        rows = await self._db.store.query_raw(
            f"""
            UPDATE saved_prompts SET
              title = COALESCE($3, title),
              body = COALESCE($4, body),
              updated_at = now()
            WHERE id = $1::uuid AND workspace_id = $2::uuid
            RETURNING {_COLS}
            """,
            prompt_id,
            workspace_id,
            title,
            body,
        )
        return rows[0] if rows else None

    async def delete(self, *, prompt_id: str, workspace_id: str) -> bool:
        rows = await self._db.store.query_raw(
            "DELETE FROM saved_prompts "
            "WHERE id = $1::uuid AND workspace_id = $2::uuid RETURNING id",
            prompt_id,
            workspace_id,
        )
        return bool(rows)
