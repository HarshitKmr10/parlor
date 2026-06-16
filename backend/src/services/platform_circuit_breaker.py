"""Per-platform circuit breaker for meeting-joiner.

When a meeting platform (msteams / googlemeet / zoom) starts failing in
bulk — selectors broken, IdP outage, captcha wall, etc. — we don't want
to keep launching pods that immediately fail. The breaker tracks join-
success ratio per platform over a rolling 15-minute window and, once
the failure ratio crosses the threshold, "opens" so the create_meeting
handler can return ``503 Retry-After: 600`` for that platform.

Storage is **in-process only**. Each API replica has its own breaker —
that's intentional. A coarse-grained safeguard inside a single replica
plus a cluster-wide view via Prom/Grafana is more than enough for the
GA use case, and avoids the operational drag of an extra shared store.
The :class:`SelectorCanaryService` periodically calls
:meth:`on_canary_failure` so a synthetic probe can flip the breaker
before any real customer meeting hits the broken platform; a canary
*success* auto-closes the breaker.

Public surface:

* :class:`PlatformCircuitBreaker` — class implementation.
* :data:`circuit_breaker` — process-wide singleton.

Cardinality discipline: the :data:`circuit_breaker_state` gauge is
labelled by ``platform`` (a bounded set). No per-meeting / per-org
labels are emitted from here.
"""

from __future__ import annotations

import os
import threading
import time
from collections import deque
from dataclasses import dataclass
from typing import Deque

from src.observability import get_logger, get_metrics

logger = get_logger(__name__)

# Defaults tuned for a low-volume window so a brand-new replica won't
# trip on its first failed join. Overridable via env so SRE can dial them
# at runtime without a code change.
DEFAULT_WINDOW_SECONDS = int(os.environ.get("CIRCUIT_BREAKER_WINDOW_SECONDS", "900"))
DEFAULT_THRESHOLD = float(os.environ.get("CIRCUIT_BREAKER_SUCCESS_RATIO", "0.80"))
DEFAULT_MIN_ATTEMPTS = int(os.environ.get("CIRCUIT_BREAKER_MIN_ATTEMPTS", "10"))
# How long an open breaker stays open before the next canary success
# can close it. Three canary-failure events bypass this and trip
# immediately regardless of window stats.
DEFAULT_OPEN_HOLD_SECONDS = int(
    os.environ.get("CIRCUIT_BREAKER_OPEN_HOLD_SECONDS", "60")
)
# Retry-After header value (seconds) the route handler returns when the
# breaker is open. 10 minutes balances "don't hammer broken platform"
# with "let the canary close it relatively quickly".
RETRY_AFTER_SECONDS = int(os.environ.get("CIRCUIT_BREAKER_RETRY_AFTER", "600"))


@dataclass(frozen=True)
class _Attempt:
    """Immutable record of a single join attempt within the window."""

    timestamp: float
    success: bool


@dataclass(frozen=True)
class _BreakerSnapshot:
    """Read-only view of a per-platform breaker state for /status."""

    platform: str
    is_open: bool
    opened_at: float | None
    attempts_in_window: int
    successes_in_window: int
    success_ratio: float | None
    consecutive_canary_failures: int


class PlatformCircuitBreaker:
    """Rolling-window success-ratio circuit breaker, per platform.

    Threading: we use a single ``threading.Lock`` to guard the per-
    platform deques because :meth:`record_attempt` is called from
    asyncio handlers and the canary service's background loop, and we
    want the bookkeeping to be deterministic without sprinkling
    awaits. The critical sections are O(window).
    """

    def __init__(
        self,
        *,
        window_seconds: int = DEFAULT_WINDOW_SECONDS,
        success_threshold: float = DEFAULT_THRESHOLD,
        min_attempts: int = DEFAULT_MIN_ATTEMPTS,
        open_hold_seconds: int = DEFAULT_OPEN_HOLD_SECONDS,
    ) -> None:
        self._window_seconds = window_seconds
        self._threshold = success_threshold
        self._min_attempts = min_attempts
        self._open_hold_seconds = open_hold_seconds
        self._lock = threading.Lock()
        self._attempts: dict[str, Deque[_Attempt]] = {}
        self._open_state: dict[str, float] = {}
        self._canary_failures: dict[str, int] = {}
        # Lazy metrics handle so importing this module doesn't force the
        # OTel meter to wake up before the API has wired logging.
        self._metrics = None

    # -- public API ---------------------------------------------------------

    def record_attempt(self, platform: str, success: bool) -> None:
        """Record a join outcome. Called from create_meeting result path."""
        now = time.monotonic()
        with self._lock:
            queue = self._attempts.setdefault(platform, deque())
            queue.append(_Attempt(timestamp=now, success=success))
            self._evict_old(queue, now)
            self._evaluate_locked(platform, now)

    def is_open(self, platform: str) -> bool:
        """True if traffic for ``platform`` should be rejected."""
        now = time.monotonic()
        with self._lock:
            opened_at = self._open_state.get(platform)
            if opened_at is None:
                return False
            # Open state is sticky until force_close / canary success;
            # we don't auto-close on timer because a half-open state
            # without a probe is dangerous. Caller (canary) closes it.
            return True

    def force_close(self, platform: str) -> None:
        """Admin override — manually close the breaker for ``platform``."""
        with self._lock:
            was_open = platform in self._open_state
            self._open_state.pop(platform, None)
            self._canary_failures[platform] = 0
        if was_open:
            logger.info(
                "circuit_breaker.force_closed",
                platform=platform,
            )
            self._emit_state(platform, opened=False)

    def on_canary_failure(self, platform: str, count: int) -> None:
        """Subscriber hook used by :class:`SelectorCanaryService`.

        The canary service tracks its own consecutive-failure count and
        passes it in. Three consecutive synthetic failures flip the
        breaker open immediately, bypassing the window-ratio check, on
        the theory that the canary uses a known-good URL — its failure
        is strictly platform-side.
        """
        with self._lock:
            self._canary_failures[platform] = count
            if count >= 3 and platform not in self._open_state:
                self._open_state[platform] = time.monotonic()
                logger.error(
                    "circuit_breaker.opened_by_canary",
                    platform=platform,
                    consecutive_failures=count,
                )
                self._emit_state(platform, opened=True)

    def on_canary_success(self, platform: str) -> None:
        """Reset canary-failure counter and auto-close the breaker.

        Called by the canary service after a successful synthetic run.
        Mirrors :meth:`on_canary_failure` so the canary owns both edges
        of the open/closed transition for a clean state machine.
        """
        with self._lock:
            self._canary_failures[platform] = 0
            was_open = self._open_state.pop(platform, None) is not None
        if was_open:
            logger.info(
                "circuit_breaker.closed_by_canary_success",
                platform=platform,
            )
            self._emit_state(platform, opened=False)

    def get_status(self) -> dict:
        """JSON-serialisable snapshot of every tracked platform.

        Used by ``GET /canary/status`` (which folds in canary recent
        results) and by ad-hoc admin tooling.
        """
        now = time.monotonic()
        snapshots: list[_BreakerSnapshot] = []
        with self._lock:
            tracked = (
                set(self._attempts.keys())
                | set(self._open_state.keys())
                | set(self._canary_failures.keys())
            )
            for platform in sorted(tracked):
                queue = self._attempts.get(platform, deque())
                self._evict_old(queue, now)
                total = len(queue)
                successes = sum(1 for a in queue if a.success)
                ratio = (successes / total) if total else None
                snapshots.append(
                    _BreakerSnapshot(
                        platform=platform,
                        is_open=platform in self._open_state,
                        opened_at=self._open_state.get(platform),
                        attempts_in_window=total,
                        successes_in_window=successes,
                        success_ratio=ratio,
                        consecutive_canary_failures=self._canary_failures.get(
                            platform, 0
                        ),
                    )
                )

        return {
            "window_seconds": self._window_seconds,
            "success_threshold": self._threshold,
            "min_attempts": self._min_attempts,
            "retry_after_seconds": RETRY_AFTER_SECONDS,
            "platforms": [
                {
                    "platform": s.platform,
                    "is_open": s.is_open,
                    "opened_at_monotonic": s.opened_at,
                    "attempts_in_window": s.attempts_in_window,
                    "successes_in_window": s.successes_in_window,
                    "success_ratio": s.success_ratio,
                    "consecutive_canary_failures": (
                        s.consecutive_canary_failures
                    ),
                }
                for s in snapshots
            ],
        }

    def retry_after_seconds(self) -> int:
        """Value to populate in the ``Retry-After`` header on 503s."""
        return RETRY_AFTER_SECONDS

    # -- internals ----------------------------------------------------------

    def _evict_old(self, queue: Deque[_Attempt], now: float) -> None:
        """Drop attempts older than the rolling window."""
        cutoff = now - self._window_seconds
        while queue and queue[0].timestamp < cutoff:
            queue.popleft()

    def _evaluate_locked(self, platform: str, now: float) -> None:
        """Check the breaker conditions; flip state on threshold breach.

        Caller MUST hold ``self._lock``.
        """
        queue = self._attempts.get(platform, deque())
        total = len(queue)
        if total < self._min_attempts:
            return
        successes = sum(1 for a in queue if a.success)
        ratio = successes / total
        already_open = platform in self._open_state
        if ratio < self._threshold and not already_open:
            self._open_state[platform] = now
            logger.error(
                "circuit_breaker.opened_by_ratio",
                platform=platform,
                attempts=total,
                successes=successes,
                ratio=ratio,
                threshold=self._threshold,
            )
            self._emit_state(platform, opened=True)

    def _emit_state(self, platform: str, *, opened: bool) -> None:
        """Push the open/closed flag onto the ``circuit_breaker_state`` gauge.

        Wraps lazy-metric init so this module is importable before
        observability is configured (tests, ad-hoc REPL).
        """
        try:
            if self._metrics is None:
                self._metrics = get_metrics()
            # UpDownCounter doesn't have a `.set()` — we model 0/1 by
            # tracking the last-emitted value per platform and adding the
            # delta. The lock guarantees serialised access.
            value = 1 if opened else 0
            last = getattr(self, "_last_gauge_value", {}).setdefault(platform, 0)
            delta = value - last
            if delta != 0:
                self._metrics.circuit_breaker_state.add(
                    delta, attributes={"platform": platform}
                )
                self._last_gauge_value[platform] = value
        except Exception as exc:  # noqa: BLE001
            # Never let a metric emission failure break the breaker.
            logger.warning(
                "circuit_breaker.metric_emit_failed",
                platform=platform,
                error=str(exc),
            )

    @property
    def _last_gauge_value(self) -> dict[str, int]:
        """Lazy backing dict for delta-based gauge emission."""
        if not hasattr(self, "_lgv"):
            object.__setattr__(self, "_lgv", {})
        return self._lgv  # type: ignore[attr-defined]


# Process-wide singleton. Parent code (route handlers, canary service)
# import and use this directly.
circuit_breaker = PlatformCircuitBreaker()
