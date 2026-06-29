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
                    await service.deliver_one(delivery, client=client)

            await asyncio.gather(*(_go(d) for d in due))


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
