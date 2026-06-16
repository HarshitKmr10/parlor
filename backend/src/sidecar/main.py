"""FastAPI app for the meeting-worker sidecar.

Runs in every meeting-worker pod alongside the bot subprocess. The sidecar
is a thin HTTP control plane:

* ``POST /configure`` — accept config, spawn the bot.
* ``GET /health`` — derive ``meeting_state`` from heartbeat + bot-state files.
* ``POST /abort`` — graceful SIGTERM with SIGKILL fallback.
* ``GET /metrics`` — Prometheus text format.
* ``GET /`` — identity + uptime.

A background poller refreshes the JOINING / IN_MEETING / STUCK transitions
every 5 seconds so ``/health`` never has to do anything expensive itself.
"""

from __future__ import annotations

import os
import time
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import AsyncIterator, Optional

from fastapi import FastAPI, HTTPException, Response, status

from shared.secret_validator import (
    MissingSecretError,
    config_for_configure_request,
    validate_secrets,
)

try:
    from prometheus_client import (
        CONTENT_TYPE_LATEST,
        CollectorRegistry,
        Counter,
        Gauge,
        generate_latest,
    )
except ModuleNotFoundError:
    # prometheus_client is optional. Without it the sidecar must still boot and
    # spawn the bot — degrade /metrics to a no-op rather than crash the pod.
    CONTENT_TYPE_LATEST = "text/plain; version=0.0.4; charset=utf-8"

    class _NoopMetric:
        def __init__(self, *args, **kwargs) -> None: ...
        def labels(self, *args, **kwargs) -> "_NoopMetric":
            return self
        def inc(self, *args, **kwargs) -> None: ...
        def dec(self, *args, **kwargs) -> None: ...
        def set(self, *args, **kwargs) -> None: ...
        def observe(self, *args, **kwargs) -> None: ...

    class CollectorRegistry:  # type: ignore[no-redef]
        def __init__(self, *args, **kwargs) -> None: ...

    def Counter(*args, **kwargs) -> _NoopMetric:  # type: ignore[misc]
        return _NoopMetric()

    def Gauge(*args, **kwargs) -> _NoopMetric:  # type: ignore[misc]
        return _NoopMetric()

    def generate_latest(*args, **kwargs) -> bytes:  # type: ignore[misc]
        return b""

from src.observability import configure_logging, configure_otel, get_logger

from .bot_supervisor import BotSupervisor
from .heartbeat import read_bot_state, read_heartbeat_age_seconds
from .models import (
    AbortRequest,
    AbortResponse,
    ConfigureRequest,
    ConfigureResponse,
    HealthResponse,
    RootResponse,
)
from .state import MeetingState, SidecarStateManager, SidecarStateSnapshot

SERVICE_NAME = "meeting-sidecar"
SERVICE_VERSION = "1.0.0"
STUCK_HEARTBEAT_SECONDS = int(os.environ.get("STUCK_HEARTBEAT_SECONDS", "90"))
HEALTH_POLL_INTERVAL_SECONDS = float(
    os.environ.get("HEALTH_POLL_INTERVAL_SECONDS", "5")
)
SHUTDOWN_GRACE_SECONDS = int(os.environ.get("SHUTDOWN_GRACE_SECONDS", "30"))

logger = get_logger("sidecar.main")


# ---------------------------------------------------------------------------
# Prometheus metrics
# ---------------------------------------------------------------------------
# Use a dedicated registry so we don't conflict with anything the OTel SDK
# might register on the default global registry. ``/metrics`` serialises
# this registry alone.
metrics_registry = CollectorRegistry()

# One-hot encoding of meeting state. Easier to alert on
# ``sidecar_meeting_state{state="stuck"} == 1`` than to label-rewrite an int.
sidecar_meeting_state = Gauge(
    "sidecar_meeting_state",
    "Current meeting state of the sidecar (1 for active state, 0 otherwise).",
    ["state"],
    registry=metrics_registry,
)
sidecar_bot_rss_bytes = Gauge(
    "sidecar_bot_rss_bytes",
    "Resident set size of the bot subprocess in bytes.",
    registry=metrics_registry,
)
sidecar_transcript_lag_seconds = Gauge(
    "sidecar_transcript_lag_seconds",
    "Lag between live audio and the latest transcript segment, in seconds.",
    registry=metrics_registry,
)
sidecar_uptime_seconds = Counter(
    "sidecar_uptime_seconds",
    "Cumulative sidecar uptime in seconds, ticked by the health poller.",
    registry=metrics_registry,
)


def _publish_meeting_state_metric(current: MeetingState) -> None:
    """Write a one-hot encoding of the meeting state to Prometheus.

    Iterating the enum keeps us honest if states are added later: every
    state gets a labelled series, with exactly one of them set to 1.
    """
    for member in MeetingState:
        sidecar_meeting_state.labels(state=member.value).set(
            1 if member == current else 0
        )


# ---------------------------------------------------------------------------
# Shared singletons
# ---------------------------------------------------------------------------
state_manager = SidecarStateManager()
bot_supervisor = BotSupervisor(state_manager)
_app_started_at_monotonic: float = time.monotonic()
_last_poll_monotonic: float = _app_started_at_monotonic


# ---------------------------------------------------------------------------
# Health derivation
# ---------------------------------------------------------------------------
def _derive_state(
    snapshot: SidecarStateSnapshot,
    *,
    heartbeat_age: Optional[float],
    bot_state: dict,
    bot_alive: bool,
) -> MeetingState:
    """Compute the meeting state from the latest signals.

    Pure function — easy to unit-test in a follow-up PR. Falls back to the
    persisted snapshot state when no new signal flips it.
    """
    # Subprocess gone → ENDED is sticky.
    if snapshot.meeting_state == MeetingState.ENDED:
        return MeetingState.ENDED
    if not bot_alive and snapshot.bot_pid is not None:
        return MeetingState.ENDED

    # No config received yet → still WARM.
    if snapshot.config is None:
        return MeetingState.WARM

    # Bot alive but heartbeat gone stale → STUCK takes priority over the
    # snapshot's previous JOINING / IN_MEETING.
    if (
        bot_alive
        and heartbeat_age is not None
        and heartbeat_age > STUCK_HEARTBEAT_SECONDS
    ):
        return MeetingState.STUCK

    # No heartbeat file yet — bot is still booting.
    if heartbeat_age is None:
        return MeetingState.CONFIGURING

    # Heartbeat present + bot reports admission.
    reported = bot_state.get("state")
    if reported == "admitted":
        return MeetingState.IN_MEETING
    return MeetingState.JOINING


def _parse_segment_ts(value: object) -> Optional[datetime]:
    """Best-effort parse of the bot's ``last_segment_ts`` field.

    Accepts ISO-8601 with or without a trailing ``Z``. Returns ``None`` on
    anything we can't read so callers can skip the field cleanly.
    """
    if not isinstance(value, str) or not value:
        return None
    text = value.replace("Z", "+00:00") if value.endswith("Z") else value
    try:
        return datetime.fromisoformat(text)
    except ValueError:
        return None


async def _refresh_health_once() -> SidecarStateSnapshot:
    """Run a single iteration of the health poller and return the snapshot.

    Pulled out so both the background poller and ``/health`` can call it,
    keeping the ``meeting_state`` derivation logic in one place.
    """
    snapshot = await state_manager.snapshot()
    heartbeat_age = read_heartbeat_age_seconds()
    bot_state = read_bot_state()
    bot_alive = bot_supervisor.is_alive()

    derived = _derive_state(
        snapshot,
        heartbeat_age=heartbeat_age,
        bot_state=bot_state,
        bot_alive=bot_alive,
    )
    if derived != snapshot.meeting_state:
        if derived == MeetingState.ENDED:
            await state_manager.mark_ended(
                returncode=None, exit_reason="detected_dead_by_poller"
            )
        else:
            await state_manager.mark_state(derived)
        snapshot = await state_manager.snapshot()

    # Refresh Prometheus gauges every tick.
    _publish_meeting_state_metric(snapshot.meeting_state)
    rss_mb = bot_supervisor.get_rss_mb()
    if rss_mb is not None:
        sidecar_bot_rss_bytes.set(rss_mb * 1024 * 1024)
    else:
        sidecar_bot_rss_bytes.set(0)
    lag_ms = bot_state.get("transcript_lag_ms")
    if isinstance(lag_ms, (int, float)):
        sidecar_transcript_lag_seconds.set(float(lag_ms) / 1000.0)
    return snapshot


async def _health_poller_loop() -> None:
    """Forever-loop that refreshes derived state every few seconds.

    Cancelled by the FastAPI lifespan on shutdown.
    """
    import asyncio

    global _last_poll_monotonic
    logger.info(
        "sidecar.poller.start",
        interval_seconds=HEALTH_POLL_INTERVAL_SECONDS,
    )
    try:
        while True:
            try:
                await _refresh_health_once()
            except Exception as exc:
                # Never let a poller iteration crash kill the loop.
                logger.warning(
                    "sidecar.poller.iteration_failed",
                    error=str(exc),
                )
            now = time.monotonic()
            sidecar_uptime_seconds.inc(now - _last_poll_monotonic)
            _last_poll_monotonic = now
            await asyncio.sleep(HEALTH_POLL_INTERVAL_SECONDS)
    except asyncio.CancelledError:
        logger.info("sidecar.poller.stop")
        raise


# ---------------------------------------------------------------------------
# FastAPI lifespan
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Wire up observability + the background poller; tear down cleanly."""
    import asyncio

    configure_logging(os.environ.get("LOG_LEVEL", "INFO"))
    configure_otel(service_name=SERVICE_NAME, app=app)
    logger.info(
        "sidecar.startup",
        service=SERVICE_NAME,
        version=SERVICE_VERSION,
    )
    try:
        validate_secrets()
        logger.info("sidecar.secret_validation.passed")
    except (MissingSecretError, ValueError) as exc:
        logger.warning(
            "sidecar.secret_validation.startup_deferred",
            error=str(exc),
        )

    poller_task = asyncio.create_task(
        _health_poller_loop(), name="sidecar-health-poller"
    )
    try:
        yield
    finally:
        logger.info("sidecar.shutdown.begin")
        poller_task.cancel()
        try:
            await poller_task
        except asyncio.CancelledError:
            pass
        # Best-effort terminate of any still-running bot. The reaper will
        # finish the job if we miss the window.
        if bot_supervisor.is_alive():
            await bot_supervisor.terminate(grace_seconds=SHUTDOWN_GRACE_SECONDS)
        logger.info("sidecar.shutdown.done")


app = FastAPI(
    title="meeting-sidecar",
    version=SERVICE_VERSION,
    lifespan=lifespan,
)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.get("/", response_model=RootResponse)
async def root() -> RootResponse:
    """Identity probe — used by liveness checks before ``/health`` is wired."""
    uptime = time.monotonic() - _app_started_at_monotonic
    return RootResponse(
        service=SERVICE_NAME,
        version=SERVICE_VERSION,
        uptime_seconds=uptime,
    )


@app.post(
    "/configure",
    response_model=ConfigureResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def configure(request: ConfigureRequest) -> ConfigureResponse:
    """Spawn the bot subprocess for a meeting.

    Rejects with HTTP 409 unless the pod is in WARM. The API layer should
    only target warm pods, but we guard server-side too so a misrouted
    request can't trash an in-progress meeting.
    """
    snapshot = await state_manager.snapshot()
    if snapshot.meeting_state != MeetingState.WARM:
        logger.warning(
            "sidecar.configure.rejected_not_warm",
            current_state=snapshot.meeting_state.value,
            requested_meeting_id=request.meeting_id,
        )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "accepted": False,
                "meeting_id": request.meeting_id,
                "current_state": snapshot.meeting_state.value,
                "detail": (
                    "pod is not warm; refusing to start a second bot in this pod"
                ),
            },
        )

    try:
        validation_config = config_for_configure_request(
            platform=request.platform,
            transcript_source=request.transcript_source,
        )
    except ValueError as exc:
        # Unsupported platform slipped past pydantic — unlikely but defensive.
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc

    try:
        validate_secrets(validation_config)
    except (MissingSecretError, ValueError) as exc:
        logger.error(
            "sidecar.configure.secret_validation_failed",
            meeting_id=request.meeting_id,
            platform=request.platform,
            transcript_source=request.transcript_source,
            error=str(exc),
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
        ) from exc

    try:
        pid = await bot_supervisor.spawn(request)
    except ValueError as exc:
        # Unsupported subprocess platform slipped past pydantic.
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=str(exc)
        ) from exc

    await state_manager.mark_configuring(request, pid)
    return ConfigureResponse(accepted=True, meeting_id=request.meeting_id, pid=pid)


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """Snapshot of pod state for the warm pool reaper.

    Always refreshes derived state on the way in so callers polling this
    endpoint directly (without the background poller) still get fresh data
    — useful for tests and local dev.
    """
    snapshot = await _refresh_health_once()
    bot_state = read_bot_state()
    last_segment_ts = _parse_segment_ts(bot_state.get("last_segment_ts"))
    lag_ms_raw = bot_state.get("transcript_lag_ms")
    transcript_lag_ms = (
        int(lag_ms_raw) if isinstance(lag_ms_raw, (int, float)) else None
    )

    # Report the REAL heartbeat time (derived from the heartbeat file's age),
    # not "now". Fabricating now() here meant every poll looked freshly
    # heartbeated forever — so once a bot died, the reaper's ended/stuck grace
    # never elapsed, the pod was never reaped, and the meeting was never
    # completed (observed live: ended bots lingering `ongoing` with zombie
    # pods). None = the bot never wrote a heartbeat.
    heartbeat_age = read_heartbeat_age_seconds()
    last_heartbeat_ts = (
        datetime.now(timezone.utc) - timedelta(seconds=heartbeat_age)
        if heartbeat_age is not None
        else None
    )

    return HealthResponse(
        meeting_state=snapshot.meeting_state.value,
        current_meeting_id=snapshot.current_meeting_id,
        current_session_number=snapshot.current_session_number,
        last_segment_ts=last_segment_ts,
        transcript_lag_ms=transcript_lag_ms,
        bot_subprocess_alive=bot_supervisor.is_alive(),
        rss_mb=bot_supervisor.get_rss_mb(),
        last_heartbeat_ts=last_heartbeat_ts,
    )


@app.post("/abort", response_model=AbortResponse)
async def abort(request: AbortRequest) -> AbortResponse:
    """Gracefully terminate the running bot.

    Idempotent: aborting an already-ended pod returns the cached exit info
    so the API layer's retry loop doesn't surface a spurious 4xx.
    """
    logger.info(
        "sidecar.abort.received",
        reason=request.reason,
        grace_seconds=request.grace_seconds,
    )

    exit_code, exit_reason = await bot_supervisor.terminate(
        grace_seconds=request.grace_seconds
    )
    # Stamp the reason from the request so operators can tell apart
    # client-initiated aborts from sidecar-internal terminations.
    composite_reason = f"{request.reason}:{exit_reason}"
    await state_manager.mark_ended(
        returncode=exit_code, exit_reason=composite_reason
    )
    return AbortResponse(exit_reason=composite_reason, exit_code=exit_code)


@app.get("/metrics")
async def metrics() -> Response:
    """Prometheus scrape endpoint. Plain-text exposition format."""
    payload = generate_latest(metrics_registry)
    return Response(content=payload, media_type=CONTENT_TYPE_LATEST)


# ---------------------------------------------------------------------------
# Local entrypoint
# ---------------------------------------------------------------------------
def _run() -> None:  # pragma: no cover - thin uvicorn launcher
    """Module entrypoint for ``python -m src.sidecar.main``.

    Listens on port 8080 inside the pod; the API talks to the sidecar via
    the pod's cluster-internal IP.
    """
    import uvicorn

    uvicorn.run(
        "src.sidecar.main:app",
        host="0.0.0.0",  # noqa: S104 — intentional in-cluster bind
        port=int(os.environ.get("SIDECAR_PORT", "8080")),
        log_config=None,  # structlog owns logging; don't double-configure.
    )


if __name__ == "__main__":  # pragma: no cover
    _run()
