"""Persistence for workspace-scoped custom redaction rules.

Complements NlpSettingsRepo (the fixed email/phone/card policy toggles): this
stores user-defined named rules (regex / keyword / extra builtin detectors)
that are applied alongside the policy before transcripts reach the AI service,
embeddings, or public share pages.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

_COLS = (
    "id, workspace_id, name, kind, pattern, replacement, enabled, "
    "created_at, updated_at"
)


class RedactionRulesRepo:
    def __init__(self, db) -> None:
        self._db = db

    async def list(self, workspace_id: str) -> List[Dict[str, Any]]:
        return await self._db.store.query_raw(
            f"SELECT {_COLS} FROM redaction_rules WHERE workspace_id = $1::uuid "
            f"ORDER BY created_at ASC",
            workspace_id,
        )

    async def list_enabled(self, workspace_id: str) -> List[Dict[str, Any]]:
        return await self._db.store.query_raw(
            f"SELECT {_COLS} FROM redaction_rules "
            f"WHERE workspace_id = $1::uuid AND enabled = TRUE "
            f"ORDER BY created_at ASC",
            workspace_id,
        )

    async def create(
        self,
        *,
        workspace_id: str,
        name: str,
        kind: str,
        pattern: str,
        replacement: str,
    ) -> Dict[str, Any]:
        rows = await self._db.store.query_raw(
            f"""
            INSERT INTO redaction_rules
              (workspace_id, name, kind, pattern, replacement)
            VALUES ($1::uuid, $2, $3, $4, $5)
            RETURNING {_COLS}
            """,
            workspace_id,
            name,
            kind,
            pattern,
            replacement,
        )
        return rows[0]

    async def update(
        self,
        *,
        rule_id: str,
        workspace_id: str,
        name: Optional[str],
        kind: Optional[str],
        pattern: Optional[str],
        replacement: Optional[str],
        enabled: Optional[bool],
    ) -> Optional[Dict[str, Any]]:
        rows = await self._db.store.query_raw(
            f"""
            UPDATE redaction_rules SET
              name = COALESCE($3, name),
              kind = COALESCE($4, kind),
              pattern = COALESCE($5, pattern),
              replacement = COALESCE($6, replacement),
              enabled = COALESCE($7, enabled),
              updated_at = now()
            WHERE id = $1::uuid AND workspace_id = $2::uuid
            RETURNING {_COLS}
            """,
            rule_id,
            workspace_id,
            name,
            kind,
            pattern,
            replacement,
            enabled,
        )
        return rows[0] if rows else None

    async def delete(self, *, rule_id: str, workspace_id: str) -> bool:
        rows = await self._db.store.query_raw(
            "DELETE FROM redaction_rules "
            "WHERE id = $1::uuid AND workspace_id = $2::uuid RETURNING id",
            rule_id,
            workspace_id,
        )
        return bool(rows)
