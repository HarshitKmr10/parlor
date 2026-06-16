"""Persistence for per-workspace outbound integration config.

Reads/writes the ``workspace_integrations`` table (one row per
(workspace, kind), upserted on PUT). Config is stored as JSONB.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional


class IntegrationsRepo:
    def __init__(self, db) -> None:
        self._db = db

    async def list_for_workspace(self, workspace_id: str) -> List[Dict[str, Any]]:
        rows = await self._db.store.query_raw(
            "SELECT id, workspace_id, kind, config, enabled, created_at, updated_at "
            "FROM workspace_integrations WHERE workspace_id = $1::uuid "
            "ORDER BY kind ASC",
            workspace_id,
        )
        return [self._normalize(r) for r in (rows or [])]

    async def get(
        self, workspace_id: str, kind: str
    ) -> Optional[Dict[str, Any]]:
        rows = await self._db.store.query_raw(
            "SELECT id, workspace_id, kind, config, enabled, created_at, updated_at "
            "FROM workspace_integrations "
            "WHERE workspace_id = $1::uuid AND kind = $2",
            workspace_id,
            kind,
        )
        return self._normalize(rows[0]) if rows else None

    async def upsert(
        self,
        workspace_id: str,
        kind: str,
        config: Dict[str, Any],
        enabled: bool,
    ) -> Dict[str, Any]:
        rows = await self._db.store.query_raw(
            """
            INSERT INTO workspace_integrations (workspace_id, kind, config, enabled)
            VALUES ($1::uuid, $2, $3::jsonb, $4)
            ON CONFLICT (workspace_id, kind) DO UPDATE
              SET config = EXCLUDED.config,
                  enabled = EXCLUDED.enabled,
                  updated_at = NOW()
            RETURNING id, workspace_id, kind, config, enabled, created_at, updated_at
            """,
            workspace_id,
            kind,
            json.dumps(config or {}),
            enabled,
        )
        return self._normalize(rows[0])

    @staticmethod
    def _normalize(row: Dict[str, Any]) -> Dict[str, Any]:
        out = dict(row)
        cfg = out.get("config")
        if isinstance(cfg, str):
            try:
                out["config"] = json.loads(cfg)
            except (ValueError, TypeError):
                out["config"] = {}
        elif cfg is None:
            out["config"] = {}
        return out
