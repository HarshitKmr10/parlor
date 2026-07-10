"""Persistence for audit events."""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

_COLS = "id, workspace_id, actor_id, action, resource_type, resource_id, metadata, created_at"


class AuditRepo:
    def __init__(self, db) -> None:
        self._db = db

    async def create(
        self,
        *,
        workspace_id: str,
        actor_id: Optional[str],
        action: str,
        resource_type: str,
        resource_id: Optional[str],
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        rows = await self._db.store.query_raw(
            f"""
            INSERT INTO audit_events
              (workspace_id, actor_id, action, resource_type, resource_id, metadata)
            VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::jsonb)
            RETURNING {_COLS}
            """,
            workspace_id,
            actor_id,
            action,
            resource_type,
            resource_id,
            json.dumps(metadata or {}),
        )
        return rows[0]

    async def list(
        self, workspace_id: str, limit: int = 100, offset: int = 0
    ) -> List[Dict[str, Any]]:
        return await self._db.store.query_raw(
            f"SELECT {_COLS} FROM audit_events WHERE workspace_id = $1::uuid "
            f"ORDER BY created_at DESC LIMIT $2 OFFSET $3",
            workspace_id,
            limit,
            offset,
        )

    async def count(self, workspace_id: str) -> int:
        rows = await self._db.store.query_raw(
            "SELECT COUNT(*) AS n FROM audit_events WHERE workspace_id = $1::uuid",
            workspace_id,
        )
        return int(rows[0]["n"]) if rows else 0
