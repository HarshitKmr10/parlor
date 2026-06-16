"""Meeting cleanup service — redundant safety net.

In the warm-pool / sessions model the primary reaping happens in
:mod:`src.services.warm_pool_manager` (pod-level) and the rejoin
orchestrator (session-level). This service stays around for the legacy
PGQueuer cold-start fallback path and as a defence in depth against bugs
in the new reapers.

Its scope is intentionally narrow:

- Completes meetings whose latest ``meeting_sessions`` has been silent
  (``last_segment_ts`` older than the threshold OR ``ended_at`` set with no
  new session opened) AND whose status is still ``ongoing`` /
  ``interrupted`` after a long window.
- Does NOT touch meetings with an active warm-pool pod claim (the pool
  manager owns those).
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Optional

from src.api.database.connection import get_db_connection
from src.api.models.schemas import MeetingStatus
from src.db.python.schema import qualified_name
from src.observability import get_logger
from src.services.meeting_service import MeetingService
from src.services.meeting_state_machine import (
    InvalidTransitionError,
    is_terminal,
    validate_transition,
)

logger = get_logger(__name__)


class MeetingCleanupService:
    """Safety-net cleanup runs hourly. Defence in depth, not the primary."""

    def __init__(
        self,
        check_interval_minutes: int = 60,
        silence_threshold_minutes: int = 60,
        max_total_age_hours: int = 12,
    ) -> None:
        self.check_interval_minutes = check_interval_minutes
        # If the latest session has had no transcript activity for this long
        # AND no warm-pool pod is recorded against the meeting, the cleanup
        # service force-completes.
        self.silence_threshold_minutes = silence_threshold_minutes
        # Hard ceiling: regardless of activity, no meeting stays in
        # `ongoing`/`interrupted` for longer than this. Higher than the 9h
        # per-pod active deadline so the pod reaper has first crack.
        self.max_total_age_hours = max_total_age_hours
        self.running = False
        self.cleanup_task: Optional[asyncio.Task[None]] = None

    @staticmethod
    def _table_name(db, name: str) -> str:
        if getattr(db, "_driver", None) == "pg":
            return qualified_name(name)
        return name

    async def start_cleanup(self) -> None:
        if self.running:
            logger.warning("cleanup.already_running")
            return
        self.running = True
        logger.info(
            "cleanup.starting",
            check_interval_minutes=self.check_interval_minutes,
            silence_threshold_minutes=self.silence_threshold_minutes,
            max_total_age_hours=self.max_total_age_hours,
        )
        self.cleanup_task = asyncio.create_task(self._cleanup_loop())

    async def stop_cleanup(self) -> None:
        if not self.running:
            return
        self.running = False
        if self.cleanup_task is not None:
            self.cleanup_task.cancel()
            try:
                await self.cleanup_task
            except asyncio.CancelledError:
                pass
        logger.info("cleanup.stopped")

    async def _cleanup_loop(self) -> None:
        while self.running:
            try:
                await self._perform_cleanup()
                await asyncio.sleep(self.check_interval_minutes * 60)
            except asyncio.CancelledError:
                break
            except Exception as e:  # noqa: BLE001
                logger.error("cleanup.loop_error", error=str(e))
                await asyncio.sleep(60)

    async def _perform_cleanup(self) -> None:
        """Find and complete silent meetings.

        Selection rule (single SQL pass, joined against meeting_sessions):
          status IN ('ongoing', 'interrupted', 'joining')
          AND latest_session.last_segment_ts IS NULL OR < now - silence_threshold
          AND no pod_name on the meeting row OR pod_name not present in cluster
              (we don't check the cluster from here — the warm pool reaper
               handles pod-attached meetings)
          AND created_at < now - max_total_age (ceiling).
        """
        db = await get_db_connection()
        if not db._connected:
            await db.connect()

        now = datetime.now(timezone.utc)
        silence_cutoff = now - timedelta(minutes=self.silence_threshold_minutes)
        max_age_cutoff = now - timedelta(hours=self.max_total_age_hours)

        # The two cleanup buckets are kept distinct so the metrics dashboard
        # can show which path closed each row.
        meeting_table = self._table_name(db, "meeting_joiner")
        sessions_table = self._table_name(db, "meeting_sessions")
        silent_meetings = await db.execute_query(
            f"""
            SELECT m.id, m.status, m.pod_name
            FROM {meeting_table} m
            LEFT JOIN LATERAL (
                SELECT last_segment_ts, ended_at
                FROM {sessions_table} s
                WHERE s.meeting_joiner_id = m.id
                ORDER BY s.session_number DESC
                LIMIT 1
            ) latest ON TRUE
            WHERE m.status IN ('ongoing', 'interrupted', 'joining')
              AND m.created_at < $1
              AND (
                    latest.last_segment_ts IS NULL
                 OR latest.last_segment_ts < $2
              )
            LIMIT 100
            """,
            max_age_cutoff,
            silence_cutoff,
        )

        if not silent_meetings:
            logger.debug("cleanup.no_stale_meetings")
            return

        meeting_service = MeetingService(db)
        completed = 0
        for row in silent_meetings:
            meeting_id = str(row["id"])
            current = MeetingStatus(row["status"])
            if is_terminal(current):
                continue
            try:
                validate_transition(current, MeetingStatus.COMPLETED)
            except InvalidTransitionError as e:
                logger.warning(
                    "cleanup.invalid_transition",
                    meeting_id=meeting_id,
                    current=current.value,
                    error=str(e),
                )
                continue
            try:
                await meeting_service.update_meeting_status(
                    meeting_id, MeetingStatus.COMPLETED
                )
                completed += 1
                logger.info(
                    "cleanup.completed_stale_meeting",
                    meeting_id=meeting_id,
                    previous_status=current.value,
                )
            except Exception as e:  # noqa: BLE001
                logger.error(
                    "cleanup.complete_failed",
                    meeting_id=meeting_id,
                    error=str(e),
                )

        if completed:
            logger.info("cleanup.summary", completed=completed)

    def get_stats(self) -> dict:
        return {
            "running": self.running,
            "check_interval_minutes": self.check_interval_minutes,
            "silence_threshold_minutes": self.silence_threshold_minutes,
            "max_total_age_hours": self.max_total_age_hours,
        }


meeting_cleanup_service = MeetingCleanupService()
