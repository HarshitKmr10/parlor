"""Synthetic canary that exercises real meeting joins on a schedule.

The bot platform layer is heavy on Playwright + DOM selectors that
silently rot when Microsoft / Google ship UI changes. A failing canary
gives us the earliest possible signal — *before* customer meetings
start failing.

How it works:

1. Every ``CANARY_INTERVAL_MINUTES`` (default 60) the service iterates
   the platforms listed in ``CANARY_PLATFORMS``
   (default ``"msteams,googlemeet"``).
2. For each platform, it reads a stable test-tenant URL from
   ``CANARY_MSTEAMS_URL`` / ``CANARY_GOOGLEMEET_URL`` /
   ``CANARY_ZOOM_URL``. Missing URL → skip (so customers without a test
   tenant don't get spurious failures).
3. Calls :meth:`MeetingService.create_meeting` directly (in-process,
   no HTTP round-trip).
4. Polls the meeting status until ``ongoing`` (60s timeout) and the
   first transcript segment lands (3 min timeout).
5. Records the result on :data:`canary_runs_total`, keeps the last 20
   runs in memory for ``GET /canary/status``, and feeds the per-
   platform circuit breaker via ``on_canary_failure`` /
   ``on_canary_success``.

Canary meetings are tagged with ``bot_name='canary-bot'`` AND the URL
gets a ``?canary=true`` query param appended so dashboards can filter
them out of customer-facing metrics.
"""

from __future__ import annotations

import asyncio
import os
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Deque, Optional
from urllib.parse import urlencode, urlparse, urlunparse, parse_qsl

from src.api.models.schemas import MeetingStatus
from src.observability import get_logger, get_metrics
from src.services.meeting_service import MeetingService
from src.services.platform_circuit_breaker import circuit_breaker as _breaker

logger = get_logger(__name__)

DEFAULT_INTERVAL_MINUTES = int(os.environ.get("CANARY_INTERVAL_MINUTES", "60"))
DEFAULT_PLATFORMS = tuple(
    p.strip()
    for p in os.environ.get("CANARY_PLATFORMS", "msteams,googlemeet").split(",")
    if p.strip()
)
DEFAULT_ADMISSION_TIMEOUT_S = int(
    os.environ.get("CANARY_ADMISSION_TIMEOUT_SECONDS", "60")
)
DEFAULT_TRANSCRIPT_TIMEOUT_S = int(
    os.environ.get("CANARY_TRANSCRIPT_TIMEOUT_SECONDS", "180")
)
POLL_INTERVAL_S = float(os.environ.get("CANARY_POLL_INTERVAL_SECONDS", "5"))
RECENT_RESULTS_MAX = 20

# Env var name -> platform mapping. Keeping it explicit so a typo in the
# env name shows up at config time rather than a silent skip at run time.
_PLATFORM_URL_ENV: dict[str, str] = {
    "msteams": "CANARY_MSTEAMS_URL",
    "googlemeet": "CANARY_GOOGLEMEET_URL",
    "zoom": "CANARY_ZOOM_URL",
}

CANARY_BOT_NAME = "canary-bot"


@dataclass(frozen=True)
class CanaryResult:
    """Immutable record of one canary run."""

    platform: str
    started_at: datetime
    duration_seconds: float
    result: str  # one of: success | admission_timeout | transcript_timeout | error
    meeting_id: Optional[str]
    error: Optional[str] = None


@dataclass
class _PlatformState:
    """Mutable per-platform bookkeeping (consecutive failures, etc.)."""

    consecutive_failures: int = 0
    last_run_at: Optional[datetime] = None
    last_result: Optional[str] = None


def _augment_url_with_canary_flag(url: str) -> str:
    """Append ``?canary=true`` to ``url`` so dashboards can filter runs.

    Preserves existing query params. If the URL is malformed we return
    the original — better to attempt the join than to error out on a
    cosmetic field.
    """
    try:
        parsed = urlparse(url)
        params = dict(parse_qsl(parsed.query, keep_blank_values=True))
        params["canary"] = "true"
        new_query = urlencode(params)
        return urlunparse(parsed._replace(query=new_query))
    except Exception:  # noqa: BLE001
        return url


class SelectorCanaryService:
    """Background canary runner.

    Owned by ``src/main.py`` (parent wires it into the lifespan). The
    parent is also responsible for calling :meth:`start` and
    :meth:`stop`.
    """

    def __init__(self, meeting_service: MeetingService) -> None:
        self._meeting_service = meeting_service
        self._interval_minutes = DEFAULT_INTERVAL_MINUTES
        self._platforms: tuple[str, ...] = DEFAULT_PLATFORMS
        self._admission_timeout = DEFAULT_ADMISSION_TIMEOUT_S
        self._transcript_timeout = DEFAULT_TRANSCRIPT_TIMEOUT_S
        self._poll_interval = POLL_INTERVAL_S
        self._task: Optional[asyncio.Task[None]] = None
        self._stop_event: asyncio.Event = asyncio.Event()
        self._recent: Deque[CanaryResult] = deque(maxlen=RECENT_RESULTS_MAX)
        self._state_by_platform: dict[str, _PlatformState] = {
            p: _PlatformState() for p in self._platforms
        }
        # Lazy metrics so tests can run without OTel wired.
        self._metrics = None

    async def start(self) -> None:
        """Launch the background loop. Idempotent."""
        if self._task is not None and not self._task.done():
            logger.info("canary.start.already_running")
            return
        self._stop_event.clear()
        self._task = asyncio.create_task(
            self._run_loop(), name="selector-canary-loop"
        )
        logger.info(
            "canary.start",
            interval_minutes=self._interval_minutes,
            platforms=list(self._platforms),
        )

    async def stop(self) -> None:
        """Stop the background loop and wait for it to finish."""
        if self._task is None:
            return
        self._stop_event.set()
        self._task.cancel()
        try:
            await self._task
        except asyncio.CancelledError:
            pass
        except Exception as exc:  # noqa: BLE001
            logger.warning("canary.stop.task_errored", error=str(exc))
        finally:
            self._task = None
        logger.info("canary.stop")

    def get_status(self) -> dict:
        """JSON-serialisable summary for ``GET /canary/status``."""
        return {
            "running": self._task is not None and not self._task.done(),
            "interval_minutes": self._interval_minutes,
            "platforms": [
                {
                    "platform": platform,
                    "configured": _PLATFORM_URL_ENV.get(platform) in os.environ,
                    "consecutive_failures": state.consecutive_failures,
                    "last_run_at": (
                        state.last_run_at.isoformat()
                        if state.last_run_at
                        else None
                    ),
                    "last_result": state.last_result,
                }
                for platform, state in self._state_by_platform.items()
            ],
            "recent_results": [
                {
                    "platform": r.platform,
                    "started_at": r.started_at.isoformat(),
                    "duration_seconds": r.duration_seconds,
                    "result": r.result,
                    "meeting_id": r.meeting_id,
                    "error": r.error,
                }
                for r in self._recent
            ],
        }

    def get_recent_results(self) -> list[CanaryResult]:
        """Return the in-memory ring buffer of recent runs."""
        return list(self._recent)

    # -- internals ----------------------------------------------------------

    async def _run_loop(self) -> None:
        """Forever-loop that fires one canary cycle per interval."""
        try:
            while not self._stop_event.is_set():
                try:
                    await self._run_one_cycle()
                except Exception as exc:  # noqa: BLE001
                    # Never let a single cycle's bug kill the loop.
                    logger.warning(
                        "canary.cycle_errored",
                        error=str(exc),
                    )
                interval_seconds = max(60, self._interval_minutes * 60)
                try:
                    await asyncio.wait_for(
                        self._stop_event.wait(), timeout=interval_seconds
                    )
                except asyncio.TimeoutError:
                    continue
        except asyncio.CancelledError:
            raise

    async def _run_one_cycle(self) -> None:
        """Run one canary against every configured platform, in sequence."""
        for platform in self._platforms:
            url_env = _PLATFORM_URL_ENV.get(platform)
            if not url_env:
                logger.warning(
                    "canary.unknown_platform_skipped",
                    platform=platform,
                )
                continue
            test_url = os.environ.get(url_env)
            if not test_url:
                logger.info(
                    "canary.skipped_no_url",
                    platform=platform,
                    env=url_env,
                )
                continue
            await self._run_one_platform(platform, test_url)

    async def _run_one_platform(self, platform: str, test_url: str) -> None:
        """Dispatch one synthetic meeting and record the outcome."""
        started_at = datetime.now(timezone.utc)
        loop_started = asyncio.get_event_loop().time()
        meeting_id: Optional[str] = None
        result_label = "error"
        error_text: Optional[str] = None

        try:
            tagged_url = _augment_url_with_canary_flag(test_url)
            meeting = await self._meeting_service.create_meeting(
                meeting_url=tagged_url,
                org_id=None,
                bot_name=CANARY_BOT_NAME,
                transcript_source=None,
            )
            meeting_id = str(meeting.id)

            admitted = await self._await_status(
                meeting_id, MeetingStatus.ONGOING, self._admission_timeout
            )
            if not admitted:
                result_label = "admission_timeout"
            else:
                segment_seen = await self._await_first_transcript_segment(
                    meeting_id, self._transcript_timeout
                )
                result_label = (
                    "success" if segment_seen else "transcript_timeout"
                )
        except Exception as exc:  # noqa: BLE001
            result_label = "error"
            error_text = str(exc)
            logger.warning(
                "canary.run_errored",
                platform=platform,
                error=error_text,
            )

        duration = asyncio.get_event_loop().time() - loop_started
        record = CanaryResult(
            platform=platform,
            started_at=started_at,
            duration_seconds=duration,
            result=result_label,
            meeting_id=meeting_id,
            error=error_text,
        )
        self._recent.append(record)

        state = self._state_by_platform.setdefault(platform, _PlatformState())
        state.last_run_at = started_at
        state.last_result = result_label

        self._emit_run_metric(platform, result_label)

        if result_label == "success":
            state.consecutive_failures = 0
            _breaker.on_canary_success(platform)
            logger.info(
                "canary.run.success",
                platform=platform,
                meeting_id=meeting_id,
                duration_seconds=round(duration, 2),
            )
            return

        state.consecutive_failures += 1
        logger.warning(
            "canary.run.failure",
            platform=platform,
            result=result_label,
            meeting_id=meeting_id,
            consecutive_failures=state.consecutive_failures,
            error=error_text,
        )
        if state.consecutive_failures >= 3:
            logger.error(
                "canary.three_consecutive_failures",
                platform=platform,
                consecutive_failures=state.consecutive_failures,
            )
        # Always feed the breaker — its own threshold logic decides when
        # to trip. The breaker is the source of truth for "is platform
        # open" because it also sees real customer failures.
        _breaker.on_canary_failure(platform, state.consecutive_failures)

    async def _await_status(
        self, meeting_id: str, target: MeetingStatus, timeout_seconds: int
    ) -> bool:
        """Poll until the meeting reaches ``target`` or timeout elapses.

        Returns True on success, False on timeout. Uses
        :meth:`MeetingService.get_meeting_by_id` so we ride the same
        DB driver the rest of the service uses.
        """
        deadline = asyncio.get_event_loop().time() + timeout_seconds
        while asyncio.get_event_loop().time() < deadline:
            try:
                meeting = await self._meeting_service.get_meeting_by_id(
                    meeting_id
                )
            except Exception as exc:  # noqa: BLE001
                logger.warning(
                    "canary.status_poll_failed",
                    meeting_id=meeting_id,
                    error=str(exc),
                )
                meeting = None
            if meeting is not None and meeting.status == target:
                return True
            await asyncio.sleep(self._poll_interval)
        return False

    async def _await_first_transcript_segment(
        self, meeting_id: str, timeout_seconds: int
    ) -> bool:
        """Wait until at least one transcript segment lands."""
        deadline = asyncio.get_event_loop().time() + timeout_seconds
        while asyncio.get_event_loop().time() < deadline:
            try:
                meeting = await self._meeting_service.get_meeting_by_id(
                    meeting_id
                )
            except Exception as exc:  # noqa: BLE001
                logger.warning(
                    "canary.transcript_poll_failed",
                    meeting_id=meeting_id,
                    error=str(exc),
                )
                meeting = None
            if meeting is not None and self._has_segment(meeting.transcript):
                return True
            await asyncio.sleep(self._poll_interval)
        return False

    def _has_segment(self, transcript: object) -> bool:
        """Return True if the transcript blob has at least one segment.

        The transcript field is a JSONB dict with a ``content`` list of
        per-segment dicts. We accept any non-empty list as "first
        segment has landed".
        """
        if not isinstance(transcript, dict):
            return False
        content = transcript.get("content")
        return isinstance(content, list) and len(content) > 0

    def _emit_run_metric(self, platform: str, result_label: str) -> None:
        """Increment ``canary_runs_total`` for this platform/result."""
        try:
            if self._metrics is None:
                self._metrics = get_metrics()
            self._metrics.canary_runs_total.add(
                1,
                attributes={"platform": platform, "result": result_label},
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "canary.metric_emit_failed",
                platform=platform,
                error=str(exc),
            )
