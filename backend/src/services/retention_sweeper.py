"""Background sweeper that runs the two-phase retention delete.

Phase 1 (soft-delete): meetings past `retention_days` get `deleted_at` set and
their embeddings removed immediately. Phase 2 (hard-delete): meetings already
soft-deleted for longer than `RETENTION_TOMBSTONE_DAYS` are permanently
removed. Honors legal hold at both phases (pauses all deletion). Mirrors the
other background services' start/stop lifecycle; run_once() is directly
testable.
"""

from __future__ import annotations

import asyncio
import os
from datetime import datetime, timezone
from typing import Optional

from ..compliance import RetentionRepo, select_expired, select_tombstoned
from ..observability import get_logger

logger = get_logger(__name__)

_TICK_S = 3600.0  # hourly is plenty for day-granularity retention

# How long a soft-deleted meeting stays recoverable before phase 2 permanently
# removes it. Env-configurable so ops can widen/narrow the recovery window
# without a code change.
RETENTION_TOMBSTONE_DAYS = int(os.environ.get("RETENTION_TOMBSTONE_DAYS", "30"))


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
        """Run both delete phases across all workspaces. Returns total rows
        touched (soft-deleted + hard-deleted)."""
        from ..api.database.connection import get_db_connection  # noqa: PLC0415

        now = now or datetime.now(timezone.utc)
        db = await get_db_connection()
        repo = RetentionRepo(db)
        total = 0
        for setting in await repo.list_all():
            ws = str(setting["workspace_id"])
            legal_hold = bool(setting.get("legal_hold"))

            meetings = await repo.meeting_dates(ws)
            expired = select_expired(
                meetings,
                retention_days=setting.get("retention_days"),
                legal_hold=legal_hold,
                now=now,
            )
            if expired:
                soft_deleted = await repo.soft_delete_meetings(ws, expired)
                total += soft_deleted
                logger.info("retention.soft_deleted", workspace=ws, count=soft_deleted)

            tombstoned = await repo.tombstoned_meetings(ws)
            ready = select_tombstoned(
                tombstoned,
                tombstone_days=RETENTION_TOMBSTONE_DAYS,
                legal_hold=legal_hold,
                now=now,
            )
            if ready:
                hard_deleted = await repo.hard_delete_meetings(ws, ready)
                total += hard_deleted
                logger.info("retention.hard_deleted", workspace=ws, count=hard_deleted)

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
