"""Meeting scheduler — dispatches bots for meetings booked with a future time.

When ``POST /meetings`` is called with ``scheduled_at`` set, the row is created
in status ``scheduled`` and NOT dispatched immediately (no warm pod is claimed
hours in advance). This background loop closes the gap:

1. Every ``MEETING_SCHEDULER_INTERVAL_S`` (default 15 s), query
   ``meeting_joiner`` for rows in status ``scheduled`` whose ``scheduled_at``
   has come due (``<= now()``).
2. For each, atomically claim it (``UPDATE ... WHERE status='scheduled'``) so
   that with multiple API replicas only one worker dispatches the meeting.
3. Open session 1 (deferred from creation so the audit trail reflects the
   real join attempt) and run the shared :func:`src.main.dispatch_meeting`
   path — warm pool first, PGQueuer fallback second.

Mirrors :class:`src.services.ghost_pod_reaper.GhostPodReaper` in shape:
singleton, ``start()/stop()`` lifecycle, per-item error isolation.
"""

from __future__ import annotations

import asyncio
import os
from typing import Optional

from src.api.database.connection import get_db_connection
from src.db.python.schema import qualified_name
from src.observability import get_logger
from src.services.meeting_service import MeetingService

logger = get_logger(__name__)

MEETING_SCHEDULER_INTERVAL_S = int(
    os.environ.get("MEETING_SCHEDULER_INTERVAL_S", "15")
)
# Cap rows dispatched per cycle so one tick can't fan out unbounded work if a
# large backlog comes due at once. Remaining rows are picked up next tick.
MEETING_SCHEDULER_BATCH = int(os.environ.get("MEETING_SCHEDULER_BATCH", "25"))
# Dispatch the due batch concurrently (bounded). A burst of meetings booked for
# the same time drains the warm pool and falls to on-demand pod creation, which
# blocks on pod readiness (~cold-start). Dispatching serially would serialize
# those cold starts; bounded concurrency fans them out while capping simultaneous
# pressure on the K8s API and the DB connection pool.
MEETING_SCHEDULER_DISPATCH_CONCURRENCY = int(
    os.environ.get("MEETING_SCHEDULER_DISPATCH_CONCURRENCY", "12")
)


class MeetingScheduler:
    """Background loop that dispatches scheduled meetings when they come due."""

    def __init__(self) -> None:
        self._task: Optional[asyncio.Task[None]] = None
        self._running = False

    @staticmethod
    def _table_name(db, name: str) -> str:
        if getattr(db, "_driver", None) == "pg":
            return qualified_name(name)
        return name

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._loop())
        logger.info(
            "meeting_scheduler.started",
            interval_s=MEETING_SCHEDULER_INTERVAL_S,
            batch=MEETING_SCHEDULER_BATCH,
        )

    async def stop(self) -> None:
        self._running = False
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        logger.info("meeting_scheduler.stopped")

    async def _loop(self) -> None:
        while self._running:
            try:
                await self._scan_once()
            except asyncio.CancelledError:
                break
            except Exception as e:  # noqa: BLE001
                logger.error("meeting_scheduler.loop_error", error=str(e))
            await asyncio.sleep(MEETING_SCHEDULER_INTERVAL_S)

    async def _scan_once(self) -> None:
        """One pass: dispatch every due scheduled meeting, concurrently.

        Each meeting is claimed atomically (single-flight across replicas), so
        running the batch under a bounded semaphore is safe: two coroutines that
        race the same row see only one win the claim. Per-item errors are
        isolated so one bad meeting can't sink the rest of the batch.
        """
        candidates = await self._due_meetings()
        if not candidates:
            return

        sem = asyncio.Semaphore(MEETING_SCHEDULER_DISPATCH_CONCURRENCY)

        async def _dispatch_guarded(row: dict) -> None:
            meeting_id = str(row["id"])
            async with sem:
                try:
                    await self._dispatch_due(meeting_id, row)
                except Exception as e:  # noqa: BLE001
                    logger.warning(
                        "meeting_scheduler.dispatch_failed",
                        meeting_id=meeting_id,
                        error=str(e),
                    )

        await asyncio.gather(*(_dispatch_guarded(row) for row in candidates))

    async def _due_meetings(self) -> list[dict]:
        """Return scheduled rows whose time has arrived (DB clock authoritative)."""
        try:
            db = await get_db_connection()
            meeting_table = self._table_name(db, "meeting_joiner")
            rows = await db.execute_query(
                f"""
                SELECT id, meeting_url, bot_name, org_id, transcript_source
                FROM {meeting_table}
                WHERE status::text = 'scheduled'
                  AND scheduled_at IS NOT NULL
                  AND scheduled_at <= now()
                ORDER BY scheduled_at ASC
                LIMIT $1
                """,
                MEETING_SCHEDULER_BATCH,
            )
        except Exception as e:  # noqa: BLE001
            logger.warning("meeting_scheduler.due_query_failed", error=str(e))
            return []
        return [dict(r) for r in rows or []]

    async def _claim(self, meeting_id: str) -> bool:
        """Atomically take ownership of a scheduled row.

        Single-flight across API replicas: only the worker whose UPDATE
        matches ``status='scheduled'`` gets a returned row. The transition to
        ``not_joined`` mirrors a fresh on-demand meeting so the downstream
        dispatch path (and its not_joined → joining hop) behaves identically.
        """
        db = await get_db_connection()
        meeting_table = self._table_name(db, "meeting_joiner")
        won = await db.execute_one(
            f"""
            UPDATE {meeting_table}
            SET status = 'not_joined', updated_at = now()
            WHERE id = $1::uuid AND status::text = 'scheduled'
            RETURNING id
            """,
            meeting_id,
        )
        return won is not None

    async def _release_claim_for_retry(self, meeting_id: str) -> None:
        """Put a claimed due meeting back into the scheduler queue.

        A failed warm-pool configure can happen before any bot owns the
        meeting. Keep the row retryable instead of leaving it in ``not_joined``
        where the due-meeting scan will never pick it up again.
        """
        db = await get_db_connection()
        meeting_table = self._table_name(db, "meeting_joiner")
        await db.execute_query(
            f"""
            UPDATE {meeting_table}
            SET status = 'scheduled', updated_at = now()
            WHERE id = $1::uuid AND status::text = 'not_joined'
            """,
            meeting_id,
        )

    async def _mark_claim_failed(self, meeting_id: str) -> None:
        """Move a deterministic pre-spawn dispatch failure to terminal failed."""
        db = await get_db_connection()
        meeting_table = self._table_name(db, "meeting_joiner")
        await db.execute_query(
            f"""
            UPDATE {meeting_table}
            SET status = 'failed', updated_at = now()
            WHERE id = $1::uuid AND status::text = 'not_joined'
            """,
            meeting_id,
        )

    async def _dispatch_due(self, meeting_id: str, row: dict) -> None:
        if not await self._claim(meeting_id):
            # Another replica got there first, or the meeting was cancelled.
            return

        db = await get_db_connection()

        # Open session 1 now — deferred from creation so the audit trail in
        # meeting_sessions reflects the actual join attempt, not the booking.
        try:
            from ..storage.sessions_repo import get_sessions_repo

            await get_sessions_repo().open_session(
                meeting_joiner_id=meeting_id,
                pod_name=None,
                cluster_name=None,
            )
        except Exception as e:  # noqa: BLE001
            logger.warning(
                "meeting_scheduler.open_session_failed",
                meeting_id=meeting_id,
                error=str(e),
            )

        # Lazy import breaks the import cycle (main imports this module in its
        # lifespan; this module only needs dispatch_meeting at call time).
        from ..main import dispatch_meeting
        from ..shared.platformDetector import PlatformDetector
        from .pgqueuer_queue_service import pgqueuer_queue_service

        meeting_url = row["meeting_url"]
        platform = PlatformDetector.detect_platform(meeting_url)
        meeting_service = MeetingService(db)

        try:
            dispatched, message = await dispatch_meeting(
                meeting_id=meeting_id,
                meeting_url=meeting_url,
                platform=platform,
                transcript_source=row.get("transcript_source"),
                bot_name=row.get("bot_name"),
                org_id=str(row["org_id"]) if row.get("org_id") else None,
                meeting_service=meeting_service,
                queue_service=pgqueuer_queue_service,
            )
        except Exception as exc:
            if getattr(exc, "release_claim_for_retry", False):
                try:
                    await self._release_claim_for_retry(meeting_id)
                except Exception as release_error:  # noqa: BLE001
                    logger.error(
                        "meeting_scheduler.release_claim_failed",
                        meeting_id=meeting_id,
                        error=str(release_error),
                    )
            elif getattr(exc, "mark_meeting_failed", False):
                try:
                    await self._mark_claim_failed(meeting_id)
                except Exception as mark_error:  # noqa: BLE001
                    logger.error(
                        "meeting_scheduler.mark_claim_failed_error",
                        meeting_id=meeting_id,
                        error=str(mark_error),
                    )
            raise
        logger.info(
            "meeting_scheduler.dispatched",
            meeting_id=meeting_id,
            platform=platform,
            dispatched=dispatched,
            message=message,
        )

    def get_status(self) -> dict:
        return {
            "running": self._running,
            "interval_s": MEETING_SCHEDULER_INTERVAL_S,
            "batch": MEETING_SCHEDULER_BATCH,
        }


_singleton: Optional[MeetingScheduler] = None


def get_meeting_scheduler() -> MeetingScheduler:
    global _singleton
    if _singleton is None:
        _singleton = MeetingScheduler()
    return _singleton


async def close_meeting_scheduler() -> None:
    global _singleton
    if _singleton is not None:
        await _singleton.stop()
        _singleton = None
