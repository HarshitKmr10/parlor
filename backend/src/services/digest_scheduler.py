"""Background scheduler that emits workspace digests on their cadence.

Mirrors the start/stop lifecycle of the other background services. Every tick
it loads enabled preferences, checks `is_due` (pure), and for due workspaces
builds + emits the digest, then stamps last_sent_at so it won't re-send.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Optional

from ..digests import DigestPrefsRepo, is_due
from ..digests.build import build_digest
from ..digests.emit import emit_digest
from ..observability import get_logger
from ..reports import ReportsRepo

logger = get_logger(__name__)

# Check a few times an hour; is_due guards against duplicate same-day sends.
_TICK_S = 600.0


class DigestScheduler:
    def __init__(self) -> None:
        self._task: Optional[asyncio.Task[None]] = None
        self._running = False

    async def start(self) -> None:
        if self._task is not None:
            return
        self._running = True
        self._task = asyncio.create_task(self._loop(), name="digest-scheduler")

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
                await self.run_once()
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # noqa: BLE001
                logger.warning("digests.scheduler_error", error=str(exc))
            await asyncio.sleep(_TICK_S)

    async def run_once(self, now: Optional[datetime] = None) -> int:
        """Emit all due digests. Returns the number emitted. Testable directly."""
        from ..api.database.connection import get_db_connection  # noqa: PLC0415

        now = now or datetime.now(timezone.utc)
        db = await get_db_connection()
        prefs_repo = DigestPrefsRepo(db)
        reports_repo = ReportsRepo(db)
        emitted = 0
        for pref in await prefs_repo.list_enabled():
            if not is_due(pref, now, pref.get("last_sent_at")):
                continue
            digest = await build_digest(reports_repo, str(pref["workspace_id"]), now)
            result = await emit_digest(pref, digest)
            if result.get("delivered"):
                await prefs_repo.mark_sent(str(pref["workspace_id"]))
                emitted += 1
                logger.info(
                    "digests.emitted",
                    workspace=str(pref["workspace_id"]),
                    detail=result.get("detail"),
                )
        return emitted


_scheduler: Optional[DigestScheduler] = None


def get_digest_scheduler() -> DigestScheduler:
    global _scheduler
    if _scheduler is None:
        _scheduler = DigestScheduler()
    return _scheduler


async def close_digest_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        await _scheduler.stop()
        _scheduler = None
