"""Soft-cap memory monitor for the bot subprocess.

The k8s pod spec sets a hard memory limit (~5 GiB) so the kubelet
OOM-kills the pod if it runs away. That's a hard stop with no chance
to flush the transcript queue. This module is the *soft* monitor:
poll the bot's RSS every 10 s and, when it crosses
``BOT_RUNTIME_MEMORY_SOFT_CAP_MB`` (default 4500), trigger a graceful
:meth:`BotSupervisor.terminate` so the bot has time to flush its
final transcript window before exit.

Lifecycle:

* The sidecar's lifespan creates a :class:`MemoryMonitor` and calls
  :meth:`start` once the bot PID is known. Stopping the monitor is
  best-effort on sidecar teardown.
* :meth:`current_rss_mb` is safe to call from any context (including
  ``/health``) and never raises — a dying bot just returns ``None``.

Metrics: increments the ``pod_oom_kills_total`` counter on every soft-
cap breach so we can distinguish "kubelet killed us hard" from "we
preempted gracefully" in Grafana.
"""

from __future__ import annotations

import asyncio
import os
from typing import Optional

import psutil

from src.observability import get_logger, get_metrics

logger = get_logger(__name__)

DEFAULT_SOFT_CAP_MB = int(os.environ.get("BOT_RUNTIME_MEMORY_SOFT_CAP_MB", "4500"))
DEFAULT_POLL_INTERVAL_S = float(
    os.environ.get("BOT_MEMORY_POLL_INTERVAL_SECONDS", "10")
)
# Grace period passed to BotSupervisor.terminate. 30 s matches the
# bot's transcript-flush deadline so the abort flow finishes inside
# the SIGTERM window the kubelet gives us before forcing SIGKILL.
DEFAULT_GRACE_SECONDS = int(
    os.environ.get("BOT_MEMORY_TERMINATE_GRACE_SECONDS", "30")
)


class MemoryMonitor:
    """Background poller that watches the bot's RSS.

    Designed to be cheap (one ``psutil.Process(pid).memory_info()``
    call per tick) and resilient: any psutil error short-circuits to
    "bot is gone, stop monitoring" rather than crashing the loop.

    Threading: pure asyncio. The poll cadence is single-shot per
    interval so we never stack ticks if the supervisor's terminate
    takes longer than the poll interval.
    """

    def __init__(
        self,
        bot_supervisor,  # type: ignore[no-untyped-def]  # forward-ref to BotSupervisor
        *,
        soft_cap_mb: int = DEFAULT_SOFT_CAP_MB,
        poll_interval_seconds: float = DEFAULT_POLL_INTERVAL_S,
        terminate_grace_seconds: int = DEFAULT_GRACE_SECONDS,
    ) -> None:
        self._supervisor = bot_supervisor
        self._soft_cap_mb = soft_cap_mb
        self._poll_interval_seconds = poll_interval_seconds
        self._terminate_grace_seconds = terminate_grace_seconds
        self._task: Optional[asyncio.Task[None]] = None
        self._stop_event: asyncio.Event = asyncio.Event()
        self._last_rss_mb: Optional[int] = None
        self._terminated = False
        # Lazy metrics — sidecar may not have configured OTel yet.
        self._metrics = None

    async def start(self) -> None:
        """Launch the polling loop. Idempotent.

        Caller passes the supervisor instance whose bot PID will be
        polled. If the supervisor has no bot yet, the first few ticks
        simply observe ``None`` and continue — once :meth:`spawn`
        runs, polling picks up automatically.
        """
        if self._task is not None and not self._task.done():
            return
        self._stop_event.clear()
        self._terminated = False
        self._task = asyncio.create_task(
            self._run_loop(), name="memory-monitor-loop"
        )
        logger.info(
            "memory_monitor.start",
            soft_cap_mb=self._soft_cap_mb,
            poll_interval_seconds=self._poll_interval_seconds,
        )

    async def stop(self) -> None:
        """Stop the poller. Safe to call before :meth:`start`."""
        if self._task is None:
            return
        self._stop_event.set()
        self._task.cancel()
        try:
            await self._task
        except asyncio.CancelledError:
            pass
        except Exception as exc:  # noqa: BLE001
            logger.warning("memory_monitor.stop.errored", error=str(exc))
        finally:
            self._task = None
        logger.info("memory_monitor.stop")

    def current_rss_mb(self) -> Optional[int]:
        """Latest observed RSS in MiB, or ``None`` if the bot is gone.

        Surfaced through ``/health`` so the warm-pool reaper can see
        a live memory figure without needing its own psutil call.
        """
        return self._last_rss_mb

    # -- internals ----------------------------------------------------------

    async def _run_loop(self) -> None:
        """Forever-loop until cancelled or terminate fires once."""
        try:
            while not self._stop_event.is_set():
                try:
                    await self._tick()
                except Exception as exc:  # noqa: BLE001
                    logger.warning(
                        "memory_monitor.tick_errored",
                        error=str(exc),
                    )
                if self._terminated:
                    # We already triggered terminate; stop polling so we
                    # don't fire the abort flow twice on a slow exit.
                    return
                try:
                    await asyncio.wait_for(
                        self._stop_event.wait(),
                        timeout=self._poll_interval_seconds,
                    )
                except asyncio.TimeoutError:
                    continue
        except asyncio.CancelledError:
            raise

    async def _tick(self) -> None:
        """One poll cycle: read RSS, evaluate cap, act if breached."""
        rss_mb = self._read_rss_mb()
        self._last_rss_mb = rss_mb
        if rss_mb is None:
            return
        if rss_mb < self._soft_cap_mb:
            return
        if self._terminated:
            return

        # Cap breached — fire the abort flow exactly once.
        self._terminated = True
        logger.warning(
            "memory.soft_cap_breach",
            rss_mb=rss_mb,
            cap_mb=self._soft_cap_mb,
        )
        self._emit_oom_metric()
        try:
            await self._supervisor.terminate(
                grace_seconds=self._terminate_grace_seconds
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "memory_monitor.terminate_failed",
                error=str(exc),
            )

    def _read_rss_mb(self) -> Optional[int]:
        """Read the bot subprocess RSS via psutil.

        Returns ``None`` on:

        * supervisor reports no PID (bot never spawned or already gone),
        * ``NoSuchProcess`` (race with subprocess exit),
        * ``AccessDenied`` (would be a misconfigured securityContext —
          surface as None so we degrade to "no monitoring" rather than
          crash).
        """
        pid = self._supervisor.get_pid()
        if pid is None:
            return None
        try:
            proc = psutil.Process(pid)
            rss_bytes = proc.memory_info().rss
        except psutil.NoSuchProcess:
            return None
        except psutil.AccessDenied:
            logger.warning("memory_monitor.access_denied", pid=pid)
            return None
        return int(rss_bytes / (1024 * 1024))

    def _emit_oom_metric(self) -> None:
        """Bump ``pod_oom_kills_total`` with reason='soft_cap'."""
        try:
            if self._metrics is None:
                self._metrics = get_metrics()
            self._metrics.pod_oom_kills_total.add(
                1,
                attributes={"reason": "soft_cap"},
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "memory_monitor.metric_emit_failed",
                error=str(exc),
            )
