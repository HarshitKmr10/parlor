"""Workspace-scoped persistence for summary templates."""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Sequence

_COLS = (
    "id, workspace_id, created_by, name, instructions, sections, is_default, "
    "created_at, updated_at"
)


class SummaryTemplatesRepo:
    def __init__(self, db) -> None:
        self._db = db

    async def create(
        self,
        *,
        workspace_id: str,
        created_by: Optional[str],
        name: str,
        instructions: str,
        sections: Sequence[str],
        is_default: bool,
    ) -> Dict[str, Any]:
        if is_default:
            await self._clear_default(workspace_id)
        rows = await self._db.store.query_raw(
            f"""
            INSERT INTO summary_templates
              (workspace_id, created_by, name, instructions, sections, is_default)
            VALUES ($1::uuid, $2::uuid, $3, $4, $5::text[], $6)
            RETURNING {_COLS}
            """,
            workspace_id,
            created_by,
            name,
            instructions,
            list(sections),
            is_default,
        )
        return self._norm(rows[0])

    async def list_for_workspace(self, workspace_id: str) -> List[Dict[str, Any]]:
        rows = await self._db.store.query_raw(
            f"SELECT {_COLS} FROM summary_templates "
            f"WHERE workspace_id = $1::uuid ORDER BY is_default DESC, name ASC",
            workspace_id,
        )
        return [self._norm(r) for r in (rows or [])]

    async def get(
        self, template_id: str, workspace_id: str
    ) -> Optional[Dict[str, Any]]:
        rows = await self._db.store.query_raw(
            f"SELECT {_COLS} FROM summary_templates "
            f"WHERE id = $1::uuid AND workspace_id = $2::uuid",
            template_id,
            workspace_id,
        )
        return self._norm(rows[0]) if rows else None

    async def get_default(self, workspace_id: str) -> Optional[Dict[str, Any]]:
        rows = await self._db.store.query_raw(
            f"SELECT {_COLS} FROM summary_templates "
            f"WHERE workspace_id = $1::uuid AND is_default = TRUE LIMIT 1",
            workspace_id,
        )
        return self._norm(rows[0]) if rows else None

    async def update(
        self,
        *,
        template_id: str,
        workspace_id: str,
        name: Optional[str],
        instructions: Optional[str],
        sections: Optional[Sequence[str]],
        is_default: Optional[bool],
    ) -> Optional[Dict[str, Any]]:
        if is_default:
            await self._clear_default(workspace_id)
        rows = await self._db.store.query_raw(
            f"""
            UPDATE summary_templates SET
              name = COALESCE($3, name),
              instructions = COALESCE($4, instructions),
              sections = COALESCE($5::text[], sections),
              is_default = COALESCE($6, is_default),
              updated_at = NOW()
            WHERE id = $1::uuid AND workspace_id = $2::uuid
            RETURNING {_COLS}
            """,
            template_id,
            workspace_id,
            name,
            instructions,
            list(sections) if sections is not None else None,
            is_default,
        )
        return self._norm(rows[0]) if rows else None

    async def delete(self, template_id: str, workspace_id: str) -> bool:
        rows = await self._db.store.query_raw(
            "DELETE FROM summary_templates "
            "WHERE id = $1::uuid AND workspace_id = $2::uuid RETURNING id",
            template_id,
            workspace_id,
        )
        return bool(rows)

    async def _clear_default(self, workspace_id: str) -> None:
        await self._db.store.query_raw(
            "UPDATE summary_templates SET is_default = FALSE, updated_at = NOW() "
            "WHERE workspace_id = $1::uuid AND is_default = TRUE",
            workspace_id,
        )

    @staticmethod
    def _norm(row: Dict[str, Any]) -> Dict[str, Any]:
        out = dict(row)
        for key in ("id", "workspace_id", "created_by"):
            if out.get(key) is not None:
                out[key] = str(out[key])
        out["sections"] = list(out.get("sections") or [])
        return out
