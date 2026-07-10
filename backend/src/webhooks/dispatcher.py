"""Background webhook delivery dispatcher.

Polls the delivery queue, claims due rows (FOR UPDATE SKIP LOCKED), and delivers
them concurrently with a shared HTTP client. Mirrors the start/stop lifecycle of
the other background services in this codebase.
"""

from __future__ import annotations

import asyncio
from typing import Optional

import httpx

from ..observability import get_logger
from .repo import WebhooksRepo
from .safety import InvalidWebhookUrl, validate_webhook_url
from .service import WebhookService

logger = get_logger(__name__)

_POLL_INTERVAL_S = 5.0
_BATCH = 20
_CONCURRENCY = 8


class WebhookDispatcher:
    def __init__(self) -> None:
        self._task: Optional[asyncio.Task[None]] = None
        self._running = False

    async def start(self) -> None:
        if self._task is not None:
            return
        self._running = True
        self._task = asyncio.create_task(self._loop(), name="webhook-dispatcher")

    async def stop(self) -> None:
        self._running = False
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

    async def _loop(self) -> None:
        while self._running:
            try:
                await self._drain_once()
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # noqa: BLE001
                logger.warning("webhooks.dispatcher_error", error=str(exc))
            await asyncio.sleep(_POLL_INTERVAL_S)

    async def _drain_once(self) -> None:
        from ..api.database.connection import get_db_connection  # noqa: PLC0415

        db = await get_db_connection()
        repo = WebhooksRepo(db)
        due = await repo.claim_due(limit=_BATCH)
        if not due:
            return

        service = WebhookService(db)
        sem = asyncio.Semaphore(_CONCURRENCY)
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(10.0, connect=5.0)
        ) as client:

            async def _go(delivery: dict) -> None:
                async with sem:
                    if not await self._revalidate_url(delivery, repo):
                        return
                    await service.deliver_one(delivery, client=client)

            await asyncio.gather(*(_go(d) for d in due))

    async def _revalidate_url(self, delivery: dict, repo: WebhooksRepo) -> bool:
        """Re-run the SSRF guard immediately before delivery.

        Registration-time validation (``routes_webhooks.py``) only checked the
        URL when the endpoint was created/updated. A hostname that resolved to
        a public IP then can be repointed (DNS rebinding) to a private/internal
        IP by the time this delivery actually fires, so re-resolve and re-check
        right before the outbound call rather than trusting the stored URL.
        """
        url = delivery.get("url")
        try:
            if not url:
                raise InvalidWebhookUrl("Webhook delivery is missing a URL")
            validate_webhook_url(url)
            return True
        except InvalidWebhookUrl as exc:
            logger.warning(
                "webhooks.delivery_url_rejected",
                delivery_id=str(delivery.get("id")),
                error=str(exc),
            )
            await repo.mark_failed(
                delivery["id"],
                attempts=int(delivery.get("attempts", 0)) + 1,
                response_status=None,
                error=f"webhook URL failed pre-delivery SSRF check: {exc}",
            )
            return False


_dispatcher: Optional[WebhookDispatcher] = None


def get_webhook_dispatcher() -> WebhookDispatcher:
    global _dispatcher
    if _dispatcher is None:
        _dispatcher = WebhookDispatcher()
    return _dispatcher


async def close_webhook_dispatcher() -> None:
    global _dispatcher
    if _dispatcher is not None:
        await _dispatcher.stop()
        _dispatcher = None
