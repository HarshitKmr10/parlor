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
        """Not-yet-soft-deleted meetings, for soft-delete (phase 1) selection."""
        return await self._db.store.query_raw(
            "SELECT id, created_at FROM meeting_joiner "
            "WHERE workspace_id = $1::uuid AND deleted_at IS NULL",
            workspace_id,
        )

    async def tombstoned_meetings(self, workspace_id: str) -> List[Dict[str, Any]]:
        """Already soft-deleted meetings, for hard-delete (phase 2) selection."""
        return await self._db.store.query_raw(
            "SELECT id, deleted_at FROM meeting_joiner "
            "WHERE workspace_id = $1::uuid AND deleted_at IS NOT NULL",
            workspace_id,
        )

    @staticmethod
    def _not_on_legal_hold(workspace_param: str = "$1") -> str:
        # `ids` passed to soft/hard delete come from an earlier
        # list_all()/select_expired()/select_tombstoned() snapshot that already
        # excluded workspaces on legal hold. A hold applied *after* that
        # snapshot but before the write actually runs must still be honored,
        # so the check is folded directly into each statement's WHERE clause
        # (not a separate pre-check) -- each query_raw call may run in its own
        # pooled-connection transaction, so a prior SELECT ... FOR UPDATE
        # wouldn't reliably hold a lock across calls anyway.
        return (
            "NOT COALESCE("
            f"(SELECT legal_hold FROM workspace_retention_settings "
            f"WHERE workspace_id = {workspace_param}::uuid), FALSE)"
        )

    async def soft_delete_meetings(self, workspace_id: str, ids: List[str]) -> int:
        """Phase 1: tombstone expired meetings and drop their embeddings.

        Embeddings are removed immediately (expensive to regenerate but not
        the source-of-truth data, and dropping them meaningfully reduces
        retained PII/content surface area). The `meeting_joiner` row itself is
        only soft-deleted so it can be restored during the tombstone window.
        """
        if not ids:
            return 0
        not_on_legal_hold = self._not_on_legal_hold()
        # Embeddings live in a separate table keyed by text meeting_id.
        await self._db.store.query_raw(
            "DELETE FROM meeting_embeddings WHERE workspace_id = $1 "
            f"AND meeting_id = ANY($2::text[]) AND {not_on_legal_hold}",
            workspace_id,
            ids,
        )
        rows = await self._db.store.query_raw(
            "UPDATE meeting_joiner SET deleted_at = now() "
            "WHERE workspace_id = $1::uuid AND id = ANY($2::uuid[]) "
            f"AND deleted_at IS NULL AND {not_on_legal_hold} RETURNING id",
            workspace_id,
            ids,
        )
        return len(rows)

    async def hard_delete_meetings(self, workspace_id: str, ids: List[str]) -> int:
        """Phase 2: permanently remove meetings tombstoned past the recovery
        window. Re-checks legal_hold live, same TOCTOU-safe pattern as phase 1."""
        if not ids:
            return 0
        not_on_legal_hold = self._not_on_legal_hold()
        await self._db.store.query_raw(
            "DELETE FROM meeting_embeddings WHERE workspace_id = $1 "
            f"AND meeting_id = ANY($2::text[]) AND {not_on_legal_hold}",
            workspace_id,
            ids,
        )
        rows = await self._db.store.query_raw(
            "DELETE FROM meeting_joiner WHERE workspace_id = $1::uuid "
            f"AND id = ANY($2::uuid[]) AND deleted_at IS NOT NULL "
            f"AND {not_on_legal_hold} RETURNING id",
            workspace_id,
            ids,
        )
        return len(rows)

    async def restore_meeting(self, meeting_id: str, workspace_id: str) -> bool:
        """Clear `deleted_at` on a still soft-deleted (not yet hard-deleted)
        row, scoped by workspace_id AND id together. Returns True if a row was
        restored."""
        rows = await self._db.store.query_raw(
            "UPDATE meeting_joiner SET deleted_at = NULL "
            "WHERE workspace_id = $1::uuid AND id = $2::uuid "
            "AND deleted_at IS NOT NULL RETURNING id",
            workspace_id,
            meeting_id,
        )
        return len(rows) > 0

    async def list_deleted(
        self, workspace_id: str, *, limit: int = 50, offset: int = 0
    ) -> List[Dict[str, Any]]:
        """Soft-deleted-but-not-yet-hard-deleted meetings, for the "recently
        deleted" admin view."""
        return await self._db.store.query_raw(
            "SELECT id, title, status, created_at, deleted_at FROM meeting_joiner "
            "WHERE workspace_id = $1::uuid AND deleted_at IS NOT NULL "
            "ORDER BY deleted_at DESC LIMIT $2 OFFSET $3",
            workspace_id,
            limit,
            offset,
        )

    async def count_deleted(self, workspace_id: str) -> int:
        rows = await self._db.store.query_raw(
            "SELECT COUNT(*) AS n FROM meeting_joiner "
            "WHERE workspace_id = $1::uuid AND deleted_at IS NOT NULL",
            workspace_id,
        )
        return int(rows[0]["n"]) if rows else 0

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
            "FROM meeting_joiner WHERE workspace_id = $1::uuid "
            "AND deleted_at IS NULL ORDER BY created_at",
            workspace_id,
        )
        action_items = await self._db.store.query_raw(
            "SELECT id, meeting_id, text, assignee, done FROM action_items "
            "WHERE workspace_id = $1::uuid",
            workspace_id,
        )
        return {"meetings": meetings, "action_items": action_items}
