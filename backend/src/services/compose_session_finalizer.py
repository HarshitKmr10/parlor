"""Compose-mode session finalizer.

In ``RUNTIME_MODE=compose`` the worker's bot runs detached; on a clean exit
NOTHING transitions the meeting ``ongoing -> completed`` or fires the AI
pipeline — the sidecar does not call back to the API. So a finished meeting
stays ``ongoing`` forever (the ``/live`` page keeps showing "live", and no
summary is generated).

This background poller reconciles that. A ``joining``/``ongoing`` meeting whose
bot is no longer alive on ANY worker is finalized:
  - ``ongoing`` -> ``completed``  (and the embed+summarize pipeline fires)
  - ``joining`` -> ``failed``     (the bot died before it ever joined)
It also self-heals orphans left ``ongoing`` by a worker/API restart.
"""

from __future__ import annotations

import asyncio
import os
from typing import Optional, Set, Tuple

import httpx

from ..api.database.connection import get_db_connection
from ..api.models.schemas import MeetingStatus
from ..api.product.meetings_repo import _meeting_table
from ..observability import get_logger
from .compose_worker_dispatcher import HEALTH_TIMEOUT_S, _worker_urls
from .meeting_service import MeetingService

logger = get_logger(__name__)

# Don't finalize a meeting dispatched within this window — its bot may still be
# spawning (state 'configuring') and not yet reporting alive.
_GRACE_S = int(os.environ.get("MEETING_FINALIZER_GRACE_S", "75"))
_INTERVAL_S = int(os.environ.get("MEETING_FINALIZER_INTERVAL_S", "20"))


class ComposeSessionFinalizer:
    def __init__(self) -> None:
        self._task: Optional[asyncio.Task] = None
        self._running = False

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(
            self._loop(), name="compose-session-finalizer"
        )
        logger.info("compose_finalizer.started", interval_s=_INTERVAL_S)

    async def stop(self) -> None:
        self._running = False
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            except Exception:  # noqa: BLE001
                pass
            self._task = None
        logger.info("compose_finalizer.stopped")

    async def _loop(self) -> None:
        while self._running:
            try:
                await self.scan_once()
            except Exception as exc:  # noqa: BLE001
                logger.warning("compose_finalizer.error", error=str(exc))
            await asyncio.sleep(_INTERVAL_S)

    async def _live_meeting_ids(self) -> Tuple[Set[str], bool]:
        """Return (meeting_ids with a live bot, all_workers_reachable).

        If a worker is unreachable we can't tell which meetings are live, so the
        caller skips finalizing to avoid killing a meeting whose bot is running.
        """
        live: Set[str] = set()
        all_reachable = True
        for url in _worker_urls():
            try:
                async with httpx.AsyncClient(timeout=HEALTH_TIMEOUT_S) as client:
                    resp = await client.get(f"{url}/health")
                    resp.raise_for_status()
                    data = resp.json()
                if data.get("bot_subprocess_alive") and data.get(
                    "current_meeting_id"
                ):
                    live.add(str(data["current_meeting_id"]))
            except Exception:  # noqa: BLE001 — unreachable worker
                all_reachable = False
        return live, all_reachable

    async def scan_once(self) -> int:
        urls = _worker_urls()
        if not urls:
            return 0  # not compose mode — nothing to do
        live, all_reachable = await self._live_meeting_ids()
        if not all_reachable:
            return 0  # uncertain — don't finalize this pass

        db = await get_db_connection()
        table = _meeting_table(db)
        rows = await db.store.query_raw(
            f"SELECT id, status, EXTRACT(EPOCH FROM (NOW() - updated_at)) AS age "
            f"FROM {table} WHERE status IN ('joining', 'ongoing')"
        )
        service = MeetingService(db)
        finalized = 0
        for row in rows:
            mid = str(row["id"])
            if mid in live:
                continue  # bot still running for this meeting
            if float(row.get("age") or 0) < _GRACE_S:
                continue  # too fresh — bot may still be spawning
            status = str(row["status"])
            if status == "ongoing":
                # Bot was in the meeting and has now exited cleanly → complete
                # and generate the summary from the captured transcript.
                await service.update_meeting_status(mid, MeetingStatus.COMPLETED)
                logger.info("compose_finalizer.completed", meeting_id=mid)
                self._fire_pipeline(mid)
            else:  # joining: the bot died before it ever joined
                await service.update_meeting_status(mid, MeetingStatus.FAILED)
                logger.info(
                    "compose_finalizer.failed_before_join", meeting_id=mid
                )
            finalized += 1
        return finalized

    @staticmethod
    def _fire_pipeline(meeting_id: str) -> None:
        try:
            from .completion_pipeline import (  # noqa: PLC0415
                run_completion_pipeline,
            )

            asyncio.create_task(
                run_completion_pipeline(meeting_id),
                name=f"completion-pipeline-{meeting_id}",
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "compose_finalizer.pipeline_skipped",
                meeting_id=meeting_id,
                error=str(exc),
            )


_finalizer: Optional[ComposeSessionFinalizer] = None


def get_compose_session_finalizer() -> ComposeSessionFinalizer:
    global _finalizer
    if _finalizer is None:
        _finalizer = ComposeSessionFinalizer()
    return _finalizer
