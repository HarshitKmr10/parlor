"""Persistence for webhook endpoints and the delivery queue.

Endpoint reads/writes are workspace-scoped. The dispatcher's :meth:`claim_due`
uses ``FOR UPDATE SKIP LOCKED`` so multiple API replicas never double-send the
same delivery.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional, Sequence

_EP_COLS = (
    "id, workspace_id, created_by, url, secret, description, event_types, "
    "enabled, consecutive_failures, disabled_at, created_at, updated_at"
)
_DEL_COLS = (
    "id, endpoint_id, workspace_id, event_id, event_type, payload, status, "
    "attempts, max_attempts, response_status, error, next_attempt_at, "
    "delivered_at, created_at, updated_at"
)


class WebhooksRepo:
    def __init__(self, db) -> None:
        self._db = db

    # ── endpoints ───────────────────────────────────────────────────────────

    async def create_endpoint(
        self,
        *,
        workspace_id: str,
        created_by: Optional[str],
        url: str,
        secret: str,
        description: Optional[str],
        event_types: Sequence[str],
    ) -> Dict[str, Any]:
        rows = await self._db.store.query_raw(
            f"""
            INSERT INTO webhook_endpoints
              (workspace_id, created_by, url, secret, description, event_types)
            VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::text[])
            RETURNING {_EP_COLS}
            """,
            workspace_id,
            created_by,
            url,
            secret,
            description,
            list(event_types),
        )
        return self._norm_ep(rows[0])

    async def list_endpoints(self, workspace_id: str) -> List[Dict[str, Any]]:
        rows = await self._db.store.query_raw(
            f"SELECT {_EP_COLS} FROM webhook_endpoints "
            f"WHERE workspace_id = $1::uuid ORDER BY created_at DESC",
            workspace_id,
        )
        return [self._norm_ep(r) for r in (rows or [])]

    async def get_endpoint(
        self, endpoint_id: str, workspace_id: str
    ) -> Optional[Dict[str, Any]]:
        rows = await self._db.store.query_raw(
            f"SELECT {_EP_COLS} FROM webhook_endpoints "
            f"WHERE id = $1::uuid AND workspace_id = $2::uuid",
            endpoint_id,
            workspace_id,
        )
        return self._norm_ep(rows[0]) if rows else None

    async def update_endpoint(
        self,
        *,
        endpoint_id: str,
        workspace_id: str,
        url: Optional[str],
        description: Optional[str],
        event_types: Optional[Sequence[str]],
        enabled: Optional[bool],
    ) -> Optional[Dict[str, Any]]:
        rows = await self._db.store.query_raw(
            f"""
            UPDATE webhook_endpoints SET
              url = COALESCE($3, url),
              description = COALESCE($4, description),
              event_types = COALESCE($5::text[], event_types),
              enabled = COALESCE($6, enabled),
              updated_at = NOW()
            WHERE id = $1::uuid AND workspace_id = $2::uuid
            RETURNING {_EP_COLS}
            """,
            endpoint_id,
            workspace_id,
            url,
            description,
            list(event_types) if event_types is not None else None,
            enabled,
        )
        return self._norm_ep(rows[0]) if rows else None

    async def delete_endpoint(self, endpoint_id: str, workspace_id: str) -> bool:
        rows = await self._db.store.query_raw(
            "DELETE FROM webhook_endpoints "
            "WHERE id = $1::uuid AND workspace_id = $2::uuid RETURNING id",
            endpoint_id,
            workspace_id,
        )
        return bool(rows)

    async def endpoints_for_event(self, workspace_id: str) -> List[Dict[str, Any]]:
        """Enabled endpoints for a workspace (event-type filtering done in code)."""
        rows = await self._db.store.query_raw(
            f"SELECT {_EP_COLS} FROM webhook_endpoints "
            f"WHERE workspace_id = $1::uuid AND enabled = TRUE",
            workspace_id,
        )
        return [self._norm_ep(r) for r in (rows or [])]

    async def set_endpoint_health(
        self, endpoint_id: str, *, consecutive_failures: int, disable: bool
    ) -> None:
        await self._db.store.query_raw(
            "UPDATE webhook_endpoints SET consecutive_failures = $2, "
            "enabled = CASE WHEN $3 THEN FALSE ELSE enabled END, "
            "disabled_at = CASE WHEN $3 THEN NOW() ELSE disabled_at END, "
            "updated_at = NOW() WHERE id = $1::uuid",
            endpoint_id,
            consecutive_failures,
            disable,
        )

    # ── deliveries ──────────────────────────────────────────────────────────

    async def enqueue(
        self,
        *,
        endpoint_id: str,
        workspace_id: str,
        event_id: str,
        event_type: str,
        payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        rows = await self._db.store.query_raw(
            f"""
            INSERT INTO webhook_deliveries
              (endpoint_id, workspace_id, event_id, event_type, payload)
            VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5::jsonb)
            RETURNING {_DEL_COLS}
            """,
            endpoint_id,
            workspace_id,
            event_id,
            event_type,
            json.dumps(payload),
        )
        return self._norm_del(rows[0])

    async def claim_due(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Atomically claim due pending deliveries joined with endpoint creds.

        Uses FOR UPDATE SKIP LOCKED so concurrent dispatchers don't collide.
        """
        rows = await self._db.store.query_raw(
            f"""
            WITH due AS (
              SELECT id FROM webhook_deliveries
              WHERE status = 'pending' AND next_attempt_at <= NOW()
              ORDER BY next_attempt_at ASC
              LIMIT $1
              FOR UPDATE SKIP LOCKED
            )
            UPDATE webhook_deliveries d
            SET status = 'pending', updated_at = NOW()
            FROM due
            WHERE d.id = due.id
            RETURNING {", ".join("d." + c.strip() for c in _DEL_COLS.split(","))},
              (SELECT url FROM webhook_endpoints e WHERE e.id = d.endpoint_id) AS url,
              (SELECT secret FROM webhook_endpoints e WHERE e.id = d.endpoint_id) AS secret
            """,
            limit,
        )
        return [self._norm_del(r) for r in (rows or [])]

    async def mark_delivered(
        self, delivery_id: str, *, attempts: int, response_status: int
    ) -> None:
        await self._db.store.query_raw(
            "UPDATE webhook_deliveries SET status = 'delivered', attempts = $2, "
            "response_status = $3, delivered_at = NOW(), error = NULL, "
            "updated_at = NOW() WHERE id = $1::uuid",
            delivery_id,
            attempts,
            response_status,
        )

    async def mark_retry(
        self,
        delivery_id: str,
        *,
        attempts: int,
        next_attempt_at: Any,
        response_status: Optional[int],
        error: str,
    ) -> None:
        await self._db.store.query_raw(
            "UPDATE webhook_deliveries SET status = 'pending', attempts = $2, "
            "next_attempt_at = $3, response_status = $4, error = $5, "
            "updated_at = NOW() WHERE id = $1::uuid",
            delivery_id,
            attempts,
            next_attempt_at,
            response_status,
            error[:1000] if error else error,
        )

    async def mark_failed(
        self,
        delivery_id: str,
        *,
        attempts: int,
        response_status: Optional[int],
        error: str,
    ) -> None:
        await self._db.store.query_raw(
            "UPDATE webhook_deliveries SET status = 'failed', attempts = $2, "
            "response_status = $3, error = $4, updated_at = NOW() "
            "WHERE id = $1::uuid",
            delivery_id,
            attempts,
            response_status,
            error[:1000] if error else error,
        )

    async def list_deliveries(
        self, endpoint_id: str, workspace_id: str, *, limit: int = 50
    ) -> List[Dict[str, Any]]:
        rows = await self._db.store.query_raw(
            f"SELECT {_DEL_COLS} FROM webhook_deliveries "
            f"WHERE endpoint_id = $1::uuid AND workspace_id = $2::uuid "
            f"ORDER BY created_at DESC LIMIT $3",
            endpoint_id,
            workspace_id,
            limit,
        )
        return [self._norm_del(r) for r in (rows or [])]

    async def requeue(self, delivery_id: str, workspace_id: str) -> bool:
        """Reset a delivery to pending for immediate redelivery."""
        rows = await self._db.store.query_raw(
            "UPDATE webhook_deliveries SET status = 'pending', "
            "next_attempt_at = NOW(), updated_at = NOW() "
            "WHERE id = $1::uuid AND workspace_id = $2::uuid RETURNING id",
            delivery_id,
            workspace_id,
        )
        return bool(rows)

    # ── normalizers ─────────────────────────────────────────────────────────

    @staticmethod
    def _norm_ep(row: Dict[str, Any]) -> Dict[str, Any]:
        out = dict(row)
        for key in ("id", "workspace_id", "created_by"):
            if out.get(key) is not None:
                out[key] = str(out[key])
        out["event_types"] = list(out.get("event_types") or [])
        return out

    @staticmethod
    def _norm_del(row: Dict[str, Any]) -> Dict[str, Any]:
        out = dict(row)
        for key in ("id", "endpoint_id", "workspace_id", "event_id"):
            if out.get(key) is not None:
                out[key] = str(out[key])
        payload = out.get("payload")
        if isinstance(payload, str):
            try:
                out["payload"] = json.loads(payload)
            except (ValueError, TypeError):
                out["payload"] = {}
        return out
