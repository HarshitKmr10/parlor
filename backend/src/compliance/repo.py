"""Persistence for retention settings + the sweeper's delete operations."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

_COLS = "workspace_id, retention_days, legal_hold, last_swept_at, created_at, updated_at"

DEFAULTS = {"retention_days": None, "legal_hold": False}


class RetentionRepo:
    def __init__(self, db) -> None:
        self._db = db

    async def get(self, workspace_id: str) -> Dict[str, Any]:
        rows = await self._db.store.query_raw(
            f"SELECT {_COLS} FROM workspace_retention_settings WHERE workspace_id = $1::uuid",
            workspace_id,
        )
        return rows[0] if rows else {**DEFAULTS, "workspace_id": workspace_id}

    async def upsert(
        self, *, workspace_id: str, retention_days: Optional[int], legal_hold: bool
    ) -> Dict[str, Any]:
        rows = await self._db.store.query_raw(
            f"""
            INSERT INTO workspace_retention_settings
              (workspace_id, retention_days, legal_hold)
            VALUES ($1::uuid, $2, $3)
            ON CONFLICT (workspace_id) DO UPDATE SET
              retention_days = EXCLUDED.retention_days,
              legal_hold = EXCLUDED.legal_hold,
              updated_at = now()
            RETURNING {_COLS}
            """,
            workspace_id,
            retention_days,
            legal_hold,
        )
        return rows[0]

    async def list_all(self) -> List[Dict[str, Any]]:
        return await self._db.store.query_raw(
            f"SELECT {_COLS} FROM workspace_retention_settings "
            f"WHERE retention_days IS NOT NULL AND legal_hold = FALSE"
        )

    async def meeting_dates(self, workspace_id: str) -> List[Dict[str, Any]]:
        return await self._db.store.query_raw(
            "SELECT id, created_at FROM meeting_joiner WHERE workspace_id = $1::uuid",
            workspace_id,
        )

    async def delete_meetings(self, workspace_id: str, ids: List[str]) -> int:
        if not ids:
            return 0
        # `ids` comes from an earlier list_all()/select_expired() snapshot that
        # already excluded workspaces on legal hold. A hold applied *after*
        # that snapshot but before this DELETE runs must still be honored, so
        # the check is folded directly into each DELETE's WHERE clause (not a
        # separate pre-check) -- each query_raw call may run in its own
        # pooled-connection transaction, so a prior SELECT ... FOR UPDATE
        # wouldn't reliably hold a lock across calls anyway.
        not_on_legal_hold = (
            "NOT COALESCE("
            "(SELECT legal_hold FROM workspace_retention_settings "
            "WHERE workspace_id = $1::uuid), FALSE)"
        )
        # Embeddings live in a separate table keyed by text meeting_id.
        await self._db.store.query_raw(
            "DELETE FROM meeting_embeddings WHERE workspace_id = $1 "
            f"AND meeting_id = ANY($2::text[]) AND {not_on_legal_hold}",
            workspace_id,
            ids,
        )
        rows = await self._db.store.query_raw(
            "DELETE FROM meeting_joiner WHERE workspace_id = $1::uuid "
            f"AND id = ANY($2::uuid[]) AND {not_on_legal_hold} RETURNING id",
            workspace_id,
            ids,
        )
        return len(rows)

    async def mark_swept(self, workspace_id: str) -> None:
        await self._db.store.query_raw(
            "UPDATE workspace_retention_settings SET last_swept_at = now() "
            "WHERE workspace_id = $1::uuid",
            workspace_id,
        )

    async def export_bundle(self, workspace_id: str) -> Dict[str, Any]:
        """Assemble a portable JSON bundle of the workspace's data."""
        meetings = await self._db.store.query_raw(
            "SELECT id, title, status, created_at, transcript, insights "
            "FROM meeting_joiner WHERE workspace_id = $1::uuid ORDER BY created_at",
            workspace_id,
        )
        action_items = await self._db.store.query_raw(
            "SELECT id, meeting_id, text, assignee, done FROM action_items "
            "WHERE workspace_id = $1::uuid",
            workspace_id,
        )
        return {"meetings": meetings, "action_items": action_items}
