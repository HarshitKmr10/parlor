"""Background sweeper that deletes meetings past their retention window.

Honors legal hold (pauses all deletion). Mirrors the other background services'
start/stop lifecycle; run_once() is directly testable.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Optional

from ..compliance import RetentionRepo, select_expired
from ..observability import get_logger

logger = get_logger(__name__)

_TICK_S = 3600.0  # hourly is plenty for day-granularity retention


class RetentionSweeper:
    def __init__(self) -> None:
        self._task: Optional[asyncio.Task[None]] = None
        self._running = False

    async def start(self) -> None:
        if self._task is not None:
            return
        self._running = True
        self._task = asyncio.create_task(self._loop(), name="retention-sweeper")

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
                logger.warning("retention.sweep_error", error=str(exc))
            await asyncio.sleep(_TICK_S)

    async def run_once(self, now: Optional[datetime] = None) -> int:
        """Delete expired meetings across all workspaces. Returns total deleted."""
        from ..api.database.connection import get_db_connection  # noqa: PLC0415

        now = now or datetime.now(timezone.utc)
        db = await get_db_connection()
        repo = RetentionRepo(db)
        total = 0
        for setting in await repo.list_all():
            ws = str(setting["workspace_id"])
            meetings = await repo.meeting_dates(ws)
            expired = select_expired(
                meetings,
                retention_days=setting.get("retention_days"),
                legal_hold=bool(setting.get("legal_hold")),
                now=now,
            )
            if expired:
                deleted = await repo.delete_meetings(ws, expired)
                total += deleted
                logger.info("retention.swept", workspace=ws, deleted=deleted)
            await repo.mark_swept(ws)
        return total


_sweeper: Optional[RetentionSweeper] = None


def get_retention_sweeper() -> RetentionSweeper:
    global _sweeper
    if _sweeper is None:
        _sweeper = RetentionSweeper()
    return _sweeper


async def close_retention_sweeper() -> None:
    global _sweeper
    if _sweeper is not None:
        await _sweeper.stop()
        _sweeper = None
