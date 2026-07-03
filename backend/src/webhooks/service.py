"""Webhook emission + delivery.

``emit_event`` fans an event out to a workspace's subscribed endpoints by
enqueuing one delivery row each (the dispatcher sends them). ``deliver_one``
performs a single signed HTTP attempt and advances the delivery's state machine
(delivered / retry-with-backoff / failed), and trips an endpoint's auto-disable
after sustained failure.
"""

from __future__ import annotations

import json
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

import httpx

from ..observability import get_logger
from .events import backoff_seconds, event_matches, is_known_event
from .repo import WebhooksRepo
from .signing import build_signature_header

logger = get_logger(__name__)

_TIMEOUT = httpx.Timeout(10.0, connect=5.0)
# Disable an endpoint after this many consecutive terminal failures.
_AUTO_DISABLE_THRESHOLD = 15


def _envelope(event_id: str, event_type: str, data: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": event_id,
        "type": event_type,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "data": data,
    }


async def emit_event(
    db, workspace_id: str, event_type: str, data: Dict[str, Any]
) -> int:
    """Enqueue ``event_type`` to every subscribed endpoint. Returns #enqueued.

    Never raises — event emission must not break the originating action.
    """
    try:
        if not is_known_event(event_type):
            logger.warning("webhooks.unknown_event", event_type=event_type)
            return 0
        repo = WebhooksRepo(db)
        endpoints = await repo.endpoints_for_event(workspace_id)
        if not endpoints:
            return 0

        event_id = str(uuid.uuid4())
        payload = _envelope(event_id, event_type, data)
        enqueued = 0
        for ep in endpoints:
            if not event_matches(event_type, ep.get("event_types")):
                continue
            await repo.enqueue(
                endpoint_id=ep["id"],
                workspace_id=workspace_id,
                event_id=event_id,
                event_type=event_type,
                payload=payload,
            )
            enqueued += 1
        if enqueued:
            logger.info("webhooks.emitted", event_type=event_type, count=enqueued)
        return enqueued
    except Exception as exc:  # noqa: BLE001
        logger.warning("webhooks.emit_failed", event_type=event_type, error=str(exc))
        return 0


class WebhookService:
    """Stateless helper bound to a DB connection for delivery operations."""

    def __init__(self, db) -> None:
        self._db = db
        self._repo = WebhooksRepo(db)

    async def deliver_one(
        self, delivery: Dict[str, Any], *, client: Optional[httpx.AsyncClient] = None
    ) -> bool:
        """Attempt one delivery; advance its state. Returns True if delivered.

        ``delivery`` must include the joined endpoint ``url`` and ``secret``
        (as :meth:`WebhooksRepo.claim_due` returns).
        """
        delivery_id = delivery["id"]
        url = delivery.get("url")
        secret = delivery.get("secret")
        attempts = int(delivery.get("attempts", 0)) + 1
        max_attempts = int(delivery.get("max_attempts", 6))

        if not url or not secret:
            await self._repo.mark_failed(
                delivery_id,
                attempts=attempts,
                response_status=None,
                error="endpoint missing url/secret",
            )
            return False

        body = json.dumps(delivery["payload"], separators=(",", ":"))
        ts = int(time.time())
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "Parlor-Webhooks/1.0",
            "X-Parlor-Signature": build_signature_header(secret, body, ts),
            "X-Parlor-Event-Type": delivery["event_type"],
            "X-Parlor-Delivery-Id": str(delivery_id),
        }

        status_code: Optional[int] = None
        error = ""
        try:
            owns_client = client is None
            client = client or httpx.AsyncClient(timeout=_TIMEOUT)
            try:
                resp = await client.post(url, content=body, headers=headers)
                status_code = resp.status_code
            finally:
                if owns_client:
                    await client.aclose()
            if 200 <= status_code < 300:
                await self._repo.mark_delivered(
                    delivery_id, attempts=attempts, response_status=status_code
                )
                await self._reset_endpoint_health(delivery["endpoint_id"])
                return True
            error = f"HTTP {status_code}"
        except Exception as exc:  # noqa: BLE001
            error = type(exc).__name__ + ": " + str(exc)

        await self._handle_failure(delivery, attempts, max_attempts, status_code, error)
        return False

    async def _handle_failure(
        self,
        delivery: Dict[str, Any],
        attempts: int,
        max_attempts: int,
        status_code: Optional[int],
        error: str,
    ) -> None:
        delivery_id = delivery["id"]
        if attempts >= max_attempts:
            await self._repo.mark_failed(
                delivery_id,
                attempts=attempts,
                response_status=status_code,
                error=error,
            )
            await self._bump_endpoint_failure(delivery["endpoint_id"])
            logger.warning(
                "webhooks.delivery_failed",
                delivery_id=str(delivery_id),
                attempts=attempts,
                error=error,
            )
        else:
            delay = backoff_seconds(attempts)
            next_at = datetime.now(timezone.utc) + timedelta(seconds=delay)
            await self._repo.mark_retry(
                delivery_id,
                attempts=attempts,
                next_attempt_at=next_at,
                response_status=status_code,
                error=error,
            )

    async def _reset_endpoint_health(self, endpoint_id: str) -> None:
        try:
            await self._repo.set_endpoint_health(
                endpoint_id, consecutive_failures=0, disable=False
            )
        except Exception:  # noqa: BLE001
            pass

    async def _bump_endpoint_failure(self, endpoint_id: str) -> None:
        try:
            ws_rows = await self._db.store.query_raw(
                "SELECT consecutive_failures FROM webhook_endpoints "
                "WHERE id = $1::uuid",
                endpoint_id,
            )
            current = int(ws_rows[0]["consecutive_failures"]) if ws_rows else 0
            nxt = current + 1
            await self._repo.set_endpoint_health(
                endpoint_id,
                consecutive_failures=nxt,
                disable=nxt >= _AUTO_DISABLE_THRESHOLD,
            )
        except Exception:  # noqa: BLE001
            pass
