"""
Meeting Joiner Service - FastAPI Application
Handles meeting creation, status tracking, and transcript retrieval
"""

import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone

UTC = timezone.utc
from typing import Optional

from dotenv import load_dotenv

load_dotenv()

import uvicorn
from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware

from shared.config import settings
from shared.exceptions import InvalidMeetingURLError, MeetingNotFoundError
from shared.secret_validator import MissingSecretError, validate_secrets
from .observability import (
    configure_logging,
    configure_otel,
    get_metrics,
    shutdown_otel,
)
from .shared.platformDetector import PlatformDetector
from .api.database.connection import get_db_connection
from .api.models.schemas import (
    HealthResponse,
    MeetingCreateRequest,
    MeetingCreateResponse,
    MeetingListItem,
    MeetingListResponse,
    MeetingStatus,
    MeetingStatusResponse,
    MeetingTranscriptResponse,
)
from .api.routes import sessions as sessions_routes
from .api.product.errors import ApiError
from .api.product.routes_auth import auth_router, workspaces_router
from .api.product.routes_calendar import router as product_calendar_router
from .api.product.routes_google_workspace import (
    router as product_google_workspace_router,
)
from .api.product.routes_action_items import router as product_action_items_router
from .api.product.routes_comments import router as product_comments_router
from .api.product.routes_highlights import router as product_highlights_router
from .api.product.routes_integrations import router as product_integrations_router
from .api.product.routes_meetings import router as product_meetings_router
from .api.product.routes_public import router as product_public_router
from .api.product.routes_reports import router as product_reports_router
from .api.product.routes_ask import router as product_ask_router
from .api.product.routes_notifications import router as product_notifications_router
from .api.product.routes_digest_prefs import router as product_digest_prefs_router
from .api.product.routes_speakers import router as product_speakers_router
from .api.product.routes_trackers import router as product_trackers_router
from .api.product.routes_nlp import router as product_nlp_router
from .api.product.routes_audit import router as product_audit_router
from .api.product.routes_sso import router as product_sso_router
from .api.product.routes_pubsub import router as product_pubsub_router
from .api.product.routes_search import router as product_search_router
from .api.product.routes_shares import router as product_shares_router
from .api.product.routes_summary_templates import (
    router as product_summary_templates_router,
)
from .api.product.routes_webhooks import router as product_webhooks_router
from .services.ghost_pod_reaper import close_ghost_pod_reaper, get_ghost_pod_reaper
from .services.meeting_scheduler import (
    close_meeting_scheduler,
    get_meeting_scheduler,
)
from .services.meeting_service import MeetingService
from .services.pgqueuer_queue_service import pgqueuer_queue_service
from .services.selector_canary_service import SelectorCanaryService
from .services.warm_pool_dispatcher import (
    SidecarConfigurePayload,
    dispatch_to_warm_pool,
)
from .services.warm_pool_manager import close_warm_pool, get_warm_pool

# Keep fallback import for compatibility
try:
    from services.simple_queue_service import simple_queue_service
except ImportError:
    simple_queue_service = None  # type: ignore

# Configure structured JSON logging once at import time so anything that runs
# before lifespan (settings parsing, secret validation) also emits JSON. The
# stdlib root logger is bridged to structlog inside configure_logging().
configure_logging(log_level=settings.LOG_LEVEL)
logger = logging.getLogger(__name__)


class WarmPoolDispatchHTTPException(HTTPException):
    """HTTP 503 with scheduler metadata about whether retry release is safe."""

    def __init__(
        self,
        *,
        detail: dict,
        release_claim_for_retry: bool,
        mark_meeting_failed: bool = False,
    ) -> None:
        super().__init__(status_code=503, detail=detail)
        self.release_claim_for_retry = release_claim_for_retry
        self.mark_meeting_failed = mark_meeting_failed


# Global worker instance - for PGQueuer, we don't need a background worker
# as PGQueuer handles job consumption automatically
worker_instance = None
worker_task = None
_canary_service: Optional["SelectorCanaryService"] = None


def _is_standalone() -> bool:
    """True when running without a Kubernetes cluster (local dev / compose).

    Gates the warm-pool, ghost-pod reaper, and selector-canary machinery — all
    of which require K8s — so the app boots cleanly against a plain Postgres.
    Both ``standalone`` and ``compose`` are K8s-free.
    """
    return os.environ.get("RUNTIME_MODE", "").lower() in ("standalone", "compose")


def _is_compose_worker_mode() -> bool:
    """True when meetings should be dispatched to a SEPARATE worker container.

    ``RUNTIME_MODE=compose`` with ``MEETING_WORKER_SIDECAR_URL`` set routes the
    bot to its own ``meeting-worker`` container's sidecar over HTTP (mirroring
    prod's API↔pod separation) instead of spawning the bot in-process. When the
    URL is unset, ``compose`` falls back to the in-process LocalBotRunner so a
    bare ``RUNTIME_MODE=compose`` still boots a working single-container dev box.
    """
    from .services.compose_worker_dispatcher import is_configured  # noqa: PLC0415

    return (
        os.environ.get("RUNTIME_MODE", "").lower() == "compose"
        and is_configured()
    )

_TEAMS_CAPTIONS_TRANSCRIPT_SOURCE_ALIASES = {
    "teams_captions",
    "team_captions",
    "captions",
    "caption",
    "closed_captions",
    "closed_caption",
    "closed_caption_from_platform",
}
_TEAMS_ASR_TRANSCRIPT_SOURCE_ALIASES = {
    "audio_asr",
    "csrc_asr",
    "asr",
    "audio",
    "streaming",
    "aws",
    "azure",
}


def _normalize_teams_env_transcript_source(raw: Optional[str]) -> Optional[str]:
    value = (raw or "").strip().lower()
    if not value:
        return None
    if value in _TEAMS_CAPTIONS_TRANSCRIPT_SOURCE_ALIASES:
        return "teams_captions"
    if value in _TEAMS_ASR_TRANSCRIPT_SOURCE_ALIASES:
        return "audio_asr"

    logger.warning(
        "Ignoring unsupported MSTEAMS_TRANSCRIPT_SOURCE=%r; expected Teams "
        "captions or audio ASR mode",
        raw,
    )
    return None


def _resolve_create_transcript_source(
    requested_source: Optional[str],
    platform: str,
) -> Optional[str]:
    if requested_source:
        return requested_source
    if platform != "msteams":
        return None
    return _normalize_teams_env_transcript_source(settings.MSTEAMS_TRANSCRIPT_SOURCE)


# Lifespan manager for startup/shutdown
@asynccontextmanager
async def lifespan(app: FastAPI):
    global worker_instance, worker_task

    # Startup
    logger.info("Starting Meeting Joiner Service")

    # Validate required secrets BEFORE touching the database or any
    # downstream service. Surface the full list of missing secrets in one
    # boot attempt instead of the operator fixing them one at a time.
    try:
        validate_secrets()
        logger.info("Secret validation passed")
    except (MissingSecretError, ValueError) as e:
        logger.error("Secret validation failed: %s", e)
        raise

    # Initialize OTel (traces + metrics) and pre-register metric instruments
    # so the first request doesn't pay the lazy-init cost.
    try:
        otel_config = configure_otel(service_name="meeting-joiner-api", app=app)
        logger.info(
            "OTel configured (enabled=%s endpoint=%s service=%s)",
            otel_config.enabled,
            otel_config.endpoint,
            otel_config.service_name,
        )
        get_metrics()
    except Exception as e:
        # Telemetry failure must never block the service from starting.
        logger.warning("OTel setup failed (continuing without telemetry): %s", e)

    try:
        # Initialize database connection
        await get_db_connection()
        logger.info("Database connection established")

        # Initialize PGQueuer service (preferred for legacy cold-start path)
        try:
            await pgqueuer_queue_service.initialize()
            logger.info("PGQueuer service initialized successfully")
        except Exception as e:
            logger.warning(f"PGQueuer service initialization failed: {e}")

            # Fallback to simple queue service if available
            if simple_queue_service:
                try:
                    await simple_queue_service.initialize()
                    logger.info("Fallback to simple queue service")
                except Exception as e2:
                    logger.warning(f"Simple queue service also failed: {e2}")

        # Start the warm pool manager — runs background replenish + reaper
        # loops via K8s. Disabled automatically when RUNTIME_MODE=compose so
        # docker-compose local dev still works without K8s.
        try:
            warm_pool = await get_warm_pool()
            if warm_pool is not None:
                status = await warm_pool.get_status()
                logger.info("Warm pool started (status=%s)", status)
            else:
                logger.info("Warm pool disabled (RUNTIME_MODE=compose or no K8s)")
        except Exception as e:
            # Warm pool init failure must not block the service: the legacy
            # PGQueuer path still handles meetings.
            logger.warning("Warm pool init failed (continuing without it): %s", e)

        # Start the selector canary — periodic synthetic meetings against
        # known test URLs. Auto-skips platforms with no canary URL configured.
        # Catches Teams/Meet DOM-selector breakage before customers do.
        global _canary_service
        if _is_standalone():
            logger.info("Selector canary disabled (RUNTIME_MODE=standalone)")
        else:
            try:
                db = await get_db_connection()
                meeting_svc = MeetingService(db)
                _canary_service = SelectorCanaryService(meeting_service=meeting_svc)
                await _canary_service.start()
                logger.info("Selector canary service started")
            except Exception as e:
                logger.warning("Canary start failed: %s", e)

        # Start the ghost-pod reaper — detects meetings whose pod
        # disappeared from k8s (node failure, force-evict) and re-runs
        # the rejoin orchestrator so the meeting doesn't silently die.
        # Complements the warm-pool reaper, which only sees pods that
        # still exist.
        if _is_standalone():
            logger.info("Ghost-pod reaper disabled (RUNTIME_MODE=standalone)")
        else:
            try:
                await get_ghost_pod_reaper().start()
                logger.info("Ghost-pod reaper started")
            except Exception as e:
                logger.warning("Ghost-pod reaper start failed: %s", e)

        # Start the meeting scheduler — dispatches bots for meetings booked
        # with a future `scheduled_at` once their time comes due.
        try:
            await get_meeting_scheduler().start()
            logger.info("Meeting scheduler started")
        except Exception as e:
            logger.warning("Meeting scheduler start failed: %s", e)

        # Start the webhook dispatcher — drains the outbound delivery queue and
        # retries failed deliveries with exponential backoff. Safe everywhere
        # (no-ops when no endpoints are registered).
        try:
            from .webhooks.dispatcher import get_webhook_dispatcher

            await get_webhook_dispatcher().start()
            logger.info("Webhook dispatcher started")
        except Exception as e:  # noqa: BLE001
            logger.warning("Webhook dispatcher start failed: %s", e)

        # Start the digest scheduler — emits due workspace digests to email/Slack.
        try:
            from .services.digest_scheduler import get_digest_scheduler

            await get_digest_scheduler().start()
            logger.info("Digest scheduler started")
        except Exception as e:  # noqa: BLE001
            logger.warning("Digest scheduler start failed: %s", e)

        # Start the calendar poller — in standalone, periodically scans
        # auto-join calendar accounts for imminent meetings and dispatches a
        # local bot. No-ops quietly when no OAuth creds are configured.
        if _is_standalone():
            try:
                from .services.calendar_poller import get_calendar_poller

                await get_calendar_poller().start()
                logger.info("Calendar poller started")
            except Exception as e:  # noqa: BLE001
                logger.warning("Calendar poller start failed: %s", e)
        else:
            logger.info("Calendar poller disabled (not standalone)")

        # Start the compose session finalizer — in compose mode the worker bot
        # runs detached and the sidecar doesn't call back on exit, so finished
        # meetings would stay 'ongoing' forever. This poller completes them and
        # fires the summary pipeline once the bot is gone.
        if _is_compose_worker_mode():
            try:
                from .services.compose_session_finalizer import (
                    get_compose_session_finalizer,
                )

                await get_compose_session_finalizer().start()
                logger.info("Compose session finalizer started")
            except Exception as e:  # noqa: BLE001
                logger.warning("Compose session finalizer start failed: %s", e)

        # Start the org-wide Google Workspace calendar sync — in standalone,
        # for each enabled Workspace org it reads every org user's calendar
        # (via domain-wide delegation) and dispatches a local bot for imminent
        # Meet meetings. Gated by GOOGLE_WORKSPACE_ENABLED; no-ops quietly when
        # disabled or when no org is configured.
        if _is_standalone():
            try:
                from .services.workspace_calendar_sync import (
                    get_workspace_calendar_sync,
                )

                if settings.GOOGLE_WORKSPACE_ENABLED:
                    await get_workspace_calendar_sync().start()
                    logger.info("Workspace calendar sync started")
                else:
                    logger.info(
                        "Workspace calendar sync disabled "
                        "(GOOGLE_WORKSPACE_ENABLED=false)"
                    )
            except Exception as e:  # noqa: BLE001
                logger.warning("Workspace calendar sync start failed: %s", e)
        else:
            logger.info("Workspace calendar sync disabled (not standalone)")

        # Start the Meet events renewer — keeps Workspace Events subscriptions
        # (ad-hoc / instant Meet capture) alive before they expire. No-ops
        # quietly when GOOGLE_WORKSPACE_ENABLED is false or no Pub/Sub topic is
        # configured, so this is safe to start unconditionally in standalone.
        if _is_standalone():
            try:
                from .services.meet_events_service import get_meet_events_renewer

                if settings.GOOGLE_WORKSPACE_ENABLED and settings.GOOGLE_PUBSUB_TOPIC:
                    await get_meet_events_renewer().start()
                    logger.info("Meet events renewer started")
                else:
                    logger.info(
                        "Meet events renewer disabled "
                        "(GOOGLE_WORKSPACE_ENABLED / GOOGLE_PUBSUB_TOPIC unset)"
                    )
            except Exception as e:  # noqa: BLE001
                logger.warning("Meet events renewer start failed: %s", e)
        else:
            logger.info("Meet events renewer disabled (not standalone)")

        logger.info(
            "Meeting Joiner Service started - run worker separately for job processing"
        )

        yield

    except Exception as e:
        logger.error(f"Failed to start service: {e}")
        raise
    finally:
        # Shutdown
        logger.info("Shutting down Meeting Joiner Service")

        # Cleanup queue service
        try:
            await pgqueuer_queue_service.cleanup()
            logger.info("PGQueuer service cleaned up")
        except Exception as e:
            logger.error(f"Error cleaning up PGQueuer service: {e}")

        if simple_queue_service:
            try:
                await simple_queue_service.cleanup()
                logger.info("Simple queue service cleaned up")
            except Exception as e:
                logger.error(f"Error cleaning up simple queue service: {e}")

        try:
            await close_ghost_pod_reaper()
            logger.info("Ghost-pod reaper stopped")
        except Exception as e:
            logger.warning("Ghost-pod reaper stop error: %s", e)

        try:
            from .webhooks.dispatcher import close_webhook_dispatcher

            await close_webhook_dispatcher()
            logger.info("Webhook dispatcher stopped")
        except Exception as e:  # noqa: BLE001
            logger.warning("Webhook dispatcher stop error: %s", e)

        try:
            from .services.digest_scheduler import close_digest_scheduler

            await close_digest_scheduler()
            logger.info("Digest scheduler stopped")
        except Exception as e:  # noqa: BLE001
            logger.warning("Digest scheduler stop error: %s", e)
        try:
            await close_meeting_scheduler()
            logger.info("Meeting scheduler stopped")
        except Exception as e:
            logger.warning("Meeting scheduler stop error: %s", e)

        try:
            from .services.compose_session_finalizer import (
                get_compose_session_finalizer,
            )

            await get_compose_session_finalizer().stop()
            logger.info("Compose session finalizer stopped")
        except Exception as e:  # noqa: BLE001
            logger.warning("Compose session finalizer stop error: %s", e)

        try:
            from .services.calendar_poller import close_calendar_poller

            await close_calendar_poller()
            logger.info("Calendar poller stopped")
        except Exception as e:  # noqa: BLE001
            logger.warning("Calendar poller stop error: %s", e)

        try:
            from .services.workspace_calendar_sync import (
                close_workspace_calendar_sync,
            )

            await close_workspace_calendar_sync()
            logger.info("Workspace calendar sync stopped")
        except Exception as e:  # noqa: BLE001
            logger.warning("Workspace calendar sync stop error: %s", e)

        try:
            from .services.meet_events_service import close_meet_events_renewer

            await close_meet_events_renewer()
            logger.info("Meet events renewer stopped")
        except Exception as e:  # noqa: BLE001
            logger.warning("Meet events renewer stop error: %s", e)

        try:
            from .services.local_bot_runner import shutdown_local_bot_runners

            await shutdown_local_bot_runners()
            logger.info("Local bot runners stopped")
        except Exception as e:  # noqa: BLE001
            logger.warning("Local bot runner shutdown error: %s", e)

        if _canary_service is not None:
            try:
                await _canary_service.stop()
                logger.info("Canary service stopped")
            except Exception as e:
                logger.warning("Canary stop error: %s", e)

        try:
            await close_warm_pool()
            logger.info("Warm pool stopped")
        except Exception as e:
            logger.warning("Warm pool stop error: %s", e)

        try:
            shutdown_otel()
        except Exception as e:
            logger.warning("OTel shutdown error: %s", e)


# Create FastAPI app
app = FastAPI(
    title="Verdant API",
    description=(
        "The Verdant meeting-intelligence API. Capture meetings, then read "
        "transcripts, summaries, analytics, highlights, action items, and ask "
        "questions across your whole workspace.\n\n"
        "**Auth:** send `Authorization: Bearer <token>` (from `/api/v1/auth/login` "
        "or a workspace API key) and `X-Workspace-Id: <workspace-id>`.\n\n"
        "**Webhooks:** subscribe at `/api/v1/webhooks` to receive HMAC-signed "
        "`transcript.ready`, `summary.ready`, and `meeting.completed` events.\n\n"
        "Generate a client with `openapi-generator-cli generate -i "
        "/openapi.json -g typescript-fetch -o ./sdk`."
    ),
    version="1.0.0",
    lifespan=lifespan,
    contact={"name": "Verdant", "url": "https://verdant.example.com"},
    license_info={"name": "Proprietary"},
)

# Add middleware.
# CORS: the web dashboard runs on http://localhost:3000 and sends the bearer
# token + X-Workspace-Id header, so it must be an explicitly allowed origin
# (wildcard "*" cannot be combined with allow_credentials in browsers).
_cors_origins = list(dict.fromkeys([*settings.ALLOWED_ORIGINS, "http://localhost:3000"]))
if "*" in _cors_origins:
    # "*" + credentials is invalid; for dev keep credentials and pin to the
    # known dashboard origin plus any explicitly configured ones.
    _cors_origins = [o for o in _cors_origins if o != "*"] or ["http://localhost:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.ALLOWED_HOSTS)

# Idempotency: replays cached responses for POSTs that carry an Idempotency-Key
# header so client retries never double-create. Best-effort; falls through on any
# store error. Added before the rate limiter so the limiter stays outermost.
try:
    from .idempotency.middleware import IdempotencyMiddleware

    app.add_middleware(IdempotencyMiddleware)
except Exception as _idem_exc:  # noqa: BLE001
    logger.warning("Idempotency middleware not installed: %s", _idem_exc)

# Rate limiting (token bucket): per API-key/user/IP, stricter for the public
# share surface. Tunable via RATE_LIMIT_* env; no-ops when RATE_LIMIT_ENABLED
# is false. Health/readiness probes and CORS preflights are exempt.
try:
    from .ratelimit.middleware import RateLimitMiddleware

    app.add_middleware(RateLimitMiddleware)
except Exception as _rl_exc:  # noqa: BLE001
    logger.warning("Rate-limit middleware not installed: %s", _rl_exc)


# Product-layer error envelope: ApiError -> { "error": { code, message, ... } }
@app.exception_handler(ApiError)
async def _api_error_handler(_request, exc: ApiError):
    from fastapi.responses import JSONResponse

    return JSONResponse(status_code=exc.status_code, content=exc.envelope())


# Internal API routes — sidecar callbacks for session-ended events.
app.include_router(sessions_routes.router)

# Product API (/api/v1): auth, workspaces, meetings. Added in front of the
# existing internal (no-auth) endpoints without altering them.
app.include_router(auth_router)
app.include_router(workspaces_router)
app.include_router(product_meetings_router)
app.include_router(product_highlights_router)
app.include_router(product_search_router)
app.include_router(product_comments_router)
app.include_router(product_shares_router)
app.include_router(product_webhooks_router)
app.include_router(product_summary_templates_router)
app.include_router(product_action_items_router)
app.include_router(product_reports_router)
app.include_router(product_ask_router)
app.include_router(product_notifications_router)
app.include_router(product_digest_prefs_router)
app.include_router(product_speakers_router)
app.include_router(product_trackers_router)
app.include_router(product_nlp_router)
app.include_router(product_audit_router)
app.include_router(product_sso_router)
# Public, UNAUTHENTICATED read-only recap via share token (capability URL).
app.include_router(product_public_router)
app.include_router(product_calendar_router)
app.include_router(product_google_workspace_router)
app.include_router(product_integrations_router)
# Pub/Sub push webhook (Google -> us; NO product auth, sender-verified).
app.include_router(product_pubsub_router)


# Dependency injection
async def get_meeting_service() -> MeetingService:
    db = await get_db_connection()
    return MeetingService(db)


async def get_queue_service():
    """Get the queue service (PGQueuer preferred, simple queue as fallback)"""
    try:
        # Try PGQueuer first
        if pgqueuer_queue_service._initialized:
            return pgqueuer_queue_service

        # Fallback to simple queue service
        if simple_queue_service and simple_queue_service._initialized:
            logger.warning("Using fallback simple queue service")
            return simple_queue_service

        # Try to initialize PGQueuer if not already done
        try:
            await pgqueuer_queue_service.initialize()
            return pgqueuer_queue_service
        except Exception as e:
            logger.error(f"Failed to initialize PGQueuer service: {e}")

            # Final fallback
            if simple_queue_service:
                await simple_queue_service.initialize()
                return simple_queue_service

        return None
    except Exception as e:
        logger.warning(f"Queue service not available: {e}")
        return None


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Liveness probe.

    Returns 200 as long as the process is alive and the database is reachable.
    K8s uses this to decide whether to restart the pod. Keep it cheap — do
    NOT add queue / external-service checks here; that's what /ready is for.
    """
    try:
        # Check database connectivity
        db = await get_db_connection()
        await db.execute_query("SELECT 1")

        return HealthResponse(
            status="healthy",
            service="meeting-joiner",
            timestamp=datetime.utcnow(),
            version="1.0.0",
        )
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=503, detail="Service unhealthy")


@app.get("/ready")
async def readiness_check():
    """Readiness probe.

    Returns 200 only when the service is ready to accept *new* work —
    distinct from liveness. K8s uses readiness to decide whether to route
    traffic; failing readiness without failing liveness lets us drain a pod
    (e.g. during PGQueuer reconnect) without forcing a restart.

    Probes (each contributes to the response payload so the operator can see
    which subsystem is degraded):
    - DB: ``SELECT 1`` round trip.
    - Queue: PGQueuer or simple-queue init flag.
    """
    checks: dict[str, str] = {}
    overall_ok = True

    try:
        db = await get_db_connection()
        await db.execute_query("SELECT 1")
        checks["database"] = "ok"
    except Exception as e:
        checks["database"] = f"error: {e}"
        overall_ok = False

    if pgqueuer_queue_service._initialized:
        checks["queue"] = "pgqueuer"
    elif simple_queue_service and getattr(simple_queue_service, "_initialized", False):
        checks["queue"] = "simple_queue_fallback"
    elif _is_standalone():
        # In standalone/compose dev the queue is optional: meetings can be
        # created and inspected without a worker consuming the queue. Don't
        # fail readiness just because PGQueuer hasn't initialized.
        checks["queue"] = "not_initialized (optional in standalone)"
    else:
        checks["queue"] = "not_initialized"
        overall_ok = False

    payload = {
        "status": "ready" if overall_ok else "not_ready",
        "service": "meeting-joiner",
        "timestamp": datetime.now(UTC).isoformat(),
        "checks": checks,
    }
    if not overall_ok:
        raise HTTPException(status_code=503, detail=payload)
    return payload


async def dispatch_meeting(
    *,
    meeting_id: str,
    meeting_url: str,
    platform: str,
    transcript_source: Optional[str],
    bot_name: Optional[str],
    org_id: Optional[str],
    meeting_service: MeetingService,
    queue_service,
    session_number: int = 1,
    allow_on_demand: bool = True,
    notetaker_email: Optional[str] = None,
) -> tuple[bool, Optional[str]]:
    """Dispatch a meeting's bot: warm pool first, PGQueuer fallback second.

    ``allow_on_demand`` is forwarded to the warm-pool dispatcher. Background
    callers (scheduler, rejoin) keep it ``True`` so bursts spin up dedicated
    pods in parallel; the inline ``POST /meetings`` handler sets it ``False`` so
    the request never blocks on a cold-start pod readiness wait.

    Shared by the immediate ``POST /meetings`` path and the meeting-scheduler
    poller, so timed and on-demand joins go through identical logic. Returns
    ``(dispatched, message)``. Raises :class:`HTTPException` (503) when the
    warm pool claims a pod but the sidecar rejects configure and no queue
    fallback is allowed — the API surfaces this for client retry; the
    scheduler catches it per-meeting.
    """
    dispatched = False
    dispatch_message: Optional[str] = None

    # Compose mode: separate meeting-worker container. The API does NOT spawn
    # the bot in-process — it POSTs the SidecarConfigurePayload to the worker's
    # sidecar /configure (same wire contract as the K8s warm pool, fixed
    # compose URL instead of a claimed pod). The worker spawns the real
    # Playwright/Chromium bot, drives heartbeats, writes transcripts to the
    # shared DB, and reports session-ended back. This mirrors prod's API↔pod
    # split. Checked BEFORE _is_standalone() (which also matches "compose") so
    # this third mode takes precedence when a worker URL is configured.
    if _is_compose_worker_mode():
        from .services.compose_worker_dispatcher import (  # noqa: PLC0415
            dispatch_to_compose_worker,
        )

        payload = SidecarConfigurePayload(
            meeting_id=meeting_id,
            meeting_url=meeting_url,
            org_id=str(org_id) if org_id else "",
            platform=platform,
            bot_name=bot_name or settings.BOT_NAME,
            session_number=session_number,
            transcript_source=transcript_source,
            notetaker_email=notetaker_email,
        )
        result = await dispatch_to_compose_worker(payload)
        if result.success:
            # Transition not_joined → joining; the worker/bot drives the rest.
            try:
                await meeting_service.update_meeting_status(
                    meeting_id, MeetingStatus.JOINING
                )
            except Exception as _e:  # noqa: BLE001
                logger.warning(
                    "Failed to transition meeting %s to joining: %s",
                    meeting_id,
                    _e,
                )
            logger.info(
                "Meeting %s dispatched to compose worker %s",
                meeting_id,
                result.worker_url,
            )
            return True, f"Dispatched to meeting-worker {result.worker_url}"

        # Terminal failure (no worker / busy / unreachable / rejected): mark
        # the meeting failed with a clear exit_reason. Never crash the API.
        if result.mark_meeting_failed:
            try:
                await meeting_service.update_meeting_status(
                    meeting_id,
                    MeetingStatus.FAILED,
                    exit_reason=result.error,
                )
            except Exception as _e:  # noqa: BLE001
                logger.warning(
                    "Failed to mark meeting %s failed after compose dispatch "
                    "error (%s): %s",
                    meeting_id,
                    result.error,
                    _e,
                )
        return False, f"Bot dispatch to meeting-worker failed: {result.error}"

    # Standalone mode: no K8s warm pool. Spawn the bot as a local subprocess
    # (mirroring the sidecar's bot_supervisor) and let the LocalBotRunner drive
    # the scheduled→joining→ongoing→completed/failed transitions + heartbeats.
    if _is_standalone():
        from .services.local_bot_runner import dispatch_local_bot  # noqa: PLC0415

        spawned = await dispatch_local_bot(
            meeting_id=meeting_id,
            meeting_url=meeting_url,
            platform=platform,
            transcript_source=transcript_source,
            bot_name=bot_name,
            org_id=org_id,
            notetaker_email=notetaker_email,
        )
        message = (
            "Bot dispatched as local subprocess"
            if spawned
            else "Bot runtime unavailable; meeting marked failed"
        )
        return spawned, message

    use_warm_pool = (
        os.environ.get("MEETING_JOINER_USE_WARM_POOL", "true").lower() != "false"
    )

    if use_warm_pool:
        payload = SidecarConfigurePayload(
            meeting_id=meeting_id,
            meeting_url=meeting_url,
            org_id=str(org_id) if org_id else "",
            platform=platform,
            bot_name=bot_name or settings.BOT_NAME,
            session_number=session_number,
            transcript_source=transcript_source,
            notetaker_email=notetaker_email,
        )
        result = await dispatch_to_warm_pool(payload, allow_on_demand=allow_on_demand)
        if result.success:
            await meeting_service.update_meeting_pod(
                meeting_id,
                result.pod_name,
                cluster_name=os.environ.get("CLUSTER_NAME"),
            )
            # RCA #34: transition not_joined → joining so the ghost-pod
            # reaper actually scans this meeting. Without this, the
            # meeting stays in `not_joined` and the reaper's status
            # filter excludes it — meaning a pod eviction is never
            # detected and rejoin never fires.
            try:
                await meeting_service.update_meeting_status(
                    meeting_id, MeetingStatus.JOINING
                )
            except Exception as _e:  # noqa: BLE001
                logger.warning(
                    "Failed to transition meeting %s to joining: %s",
                    meeting_id,
                    _e,
                )
            dispatched = True
            dispatch_message = f"Dispatched to warm-pool pod {result.pod_name}"
            logger.info(
                "Meeting %s dispatched to warm pool pod %s",
                meeting_id,
                result.pod_name,
            )
        elif not result.fallback_to_queue:
            # Warm pool claimed a pod but the sidecar rejected configure.
            # Surface this as a 503 so the client retries against a
            # freshly-replenished pool, rather than silently falling
            # back to the slow queue path.
            if result.mark_meeting_failed:
                try:
                    await meeting_service.update_meeting_status(
                        meeting_id, MeetingStatus.FAILED
                    )
                except Exception as _e:  # noqa: BLE001
                    logger.warning(
                        "Failed to mark meeting %s failed after deterministic "
                        "warm-pool dispatch rejection: %s",
                        meeting_id,
                        _e,
                    )
            raise WarmPoolDispatchHTTPException(
                detail={
                    "message": "Warm pool dispatch failed",
                    "error": result.error,
                    "retry_after_seconds": 5,
                },
                release_claim_for_retry=result.release_claim_for_retry,
                mark_meeting_failed=result.mark_meeting_failed,
            )
        else:
            logger.info(
                "Meeting %s falling back to PGQueuer (%s)",
                meeting_id,
                result.error,
            )

    # PGQueuer fallback for cold-start or when warm pool is disabled.
    job_id = None
    if not dispatched and queue_service:
        try:
            job_id = await queue_service.queue_meeting(
                meeting_id, meeting_url, bot_name
            )
            logger.info(
                f"Meeting {meeting_id} created and queued with job {job_id}"
            )
            dispatch_message = "Queued (cold-start fallback)"
        except Exception as e:
            logger.warning(f"Failed to queue meeting {meeting_id}: {e}")
    elif not dispatched:
        logger.info(f"Meeting {meeting_id} created (queue service not available)")

    message = dispatch_message or (
        "Meeting created"
        + (" and queued for processing" if job_id else " (queuing unavailable)")
    )
    return dispatched, message


@app.post("/meetings", response_model=MeetingCreateResponse)
async def create_meeting(
    request: MeetingCreateRequest,
    background_tasks: BackgroundTasks,
    meeting_service: MeetingService = Depends(get_meeting_service),
    queue_service=Depends(get_queue_service),
):
    """
    Create a new meeting and queue it for processing

    Args:
        request: Meeting creation request with meeting_url and optional org_id

    Returns:
        MeetingCreateResponse with meeting_id and status
    """
    try:
        meeting_url = str(request.meeting_url)
        platform = PlatformDetector.detect_platform(meeting_url)
        transcript_source = _resolve_create_transcript_source(
            request.transcript_source,
            platform,
        )

        logger.info(
            "Creating meeting for URL: %s (platform=%s, transcript_source=%s)",
            meeting_url,
            platform,
            transcript_source or "default",
        )

        # Validate meeting URL using platform detector
        if not PlatformDetector.is_supported(platform):
            if platform == "unknown":
                raise InvalidMeetingURLError(
                    "Invalid meeting URL - platform not recognized"
                )
            else:
                raise InvalidMeetingURLError(
                    f"Unsupported meeting platform: {platform}"
                )

        # Create meeting record in database
        meeting = await meeting_service.create_meeting(
            meeting_url=meeting_url,
            org_id=request.org_id,
            bot_name=request.bot_name,
            transcript_source=transcript_source,
            scheduled_at=request.scheduled_at,
        )

        # Duplicate-detection short circuit: an existing ongoing meeting at
        # the same URL means we're already in that meeting; no warm pod
        # claim or queue enqueue needed.
        if meeting.is_duplicate:
            return MeetingCreateResponse(
                meeting_id=meeting.id,
                status=meeting.status,
                queued_at=meeting.created_at,
                message="Linked to existing ongoing meeting - transcripts will "
                "be provided from request time onwards",
                is_duplicate=True,
                original_meeting_id=meeting.original_meeting_id,
            )

        # Scheduled meetings are registered now and dispatched later by the
        # meeting-scheduler poller when `scheduled_at` comes due — no warm
        # pod is claimed in advance.
        if meeting.scheduled_at is not None:
            return MeetingCreateResponse(
                meeting_id=meeting.id,
                status=meeting.status,
                queued_at=meeting.created_at,
                message=f"Scheduled for {meeting.scheduled_at.isoformat()}",
                is_duplicate=False,
                original_meeting_id=None,
                scheduled_at=meeting.scheduled_at,
            )

        # Immediate dispatch: warm pool first, PGQueuer fallback second.
        # allow_on_demand=False: this is the synchronous request path, so it
        # must not block on a cold-start pod readiness wait. A drained pool
        # falls back to the async queue here; the scheduler/rejoin background
        # paths are the ones that absorb bursts with on-demand pods.
        _dispatched, message = await dispatch_meeting(
            meeting_id=str(meeting.id),
            meeting_url=meeting_url,
            platform=platform,
            transcript_source=transcript_source,
            bot_name=request.bot_name,
            org_id=request.org_id,
            meeting_service=meeting_service,
            queue_service=queue_service,
            allow_on_demand=False,
        )

        return MeetingCreateResponse(
            meeting_id=meeting.id,
            status=meeting.status,
            queued_at=meeting.created_at,
            message=message,
            is_duplicate=False,
            original_meeting_id=None,
            scheduled_at=None,
        )

    except InvalidMeetingURLError as e:
        logger.error(f"Invalid meeting URL: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create meeting: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/meetings", response_model=MeetingStatusResponse)
async def get_meeting_status(
    meeting_id: str, meeting_service: MeetingService = Depends(get_meeting_service)
):
    """
    Get meeting status and basic information

    Args:
        meeting_id: UUID of the meeting

    Returns:
        MeetingStatusResponse with status, timestamps, and basic info
    """
    try:
        logger.info(f"Getting status for meeting: {meeting_id}")

        meeting = await meeting_service.get_meeting_by_id(meeting_id)
        if not meeting:
            raise MeetingNotFoundError(f"Meeting {meeting_id} not found")

        # Get participant count and basic transcript info
        participant_count = 0
        transcript_entries = 0

        if meeting.participants:
            participant_count = len(meeting.participants)

        if meeting.transcript and isinstance(meeting.transcript, dict):
            transcript_entries = len(meeting.transcript.get("content", []))

        return MeetingStatusResponse(
            meeting_id=meeting.id,
            status=meeting.status,
            meeting_url=meeting.meeting_url,
            created_at=meeting.created_at,
            bot_join_time=meeting.bot_join_time,
            bot_leave_time=meeting.bot_leave_time,
            participant_count=participant_count,
            transcript_entries=transcript_entries,
            video_link=meeting.video_link,
            org_id=meeting.org_id,
            is_duplicate=meeting.is_duplicate,
            original_meeting_id=meeting.original_meeting_id,
        )

    except MeetingNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to get meeting status: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/meetings/transcripts", response_model=MeetingTranscriptResponse)
async def get_meeting_transcript(
    meeting_id: str,
    include_speakers: bool = True,
    format: str = "detailed",
    text_only: bool = False,
    since: Optional[datetime] = None,
    meeting_service: MeetingService = Depends(get_meeting_service),
):
    """
    Get meeting transcript with optional formatting

    Args:
        meeting_id: UUID of the meeting
        include_speakers: Whether to include speaker information
        format: Response format ('detailed', 'simple', 'raw', 'text_only')
        text_only: If true, returns only concatenated text without participants data

    Returns:
        MeetingTranscriptResponse with formatted transcript
    """
    try:
        logger.info(f"Getting transcript for meeting: {meeting_id}")

        meeting = await meeting_service.get_meeting_by_id(meeting_id)
        if not meeting:
            raise MeetingNotFoundError(f"Meeting {meeting_id} not found")

        # Use text_only format if requested
        if text_only:
            format = "text_only"
            include_speakers = False

        # Format transcript based on request. `since` is forwarded so the
        # service filters out entries the dashboard already has — keeps
        # polling cheap on long meetings.
        formatted_transcript = await meeting_service.format_transcript(
            meeting.transcript,
            format=format,
            include_speakers=include_speakers,
            since=since,
        )

        # Surface the wall-clock timestamp of the freshest segment so the
        # dashboard can use it as the `since` cursor on the next poll.
        last_segment_at = None
        raw = meeting.transcript or {}
        last_ms = raw.get("lastSegmentAtMs") if isinstance(raw, dict) else None
        if last_ms:
            try:
                last_segment_at = datetime.fromtimestamp(last_ms / 1000.0, tz=UTC)
            except (TypeError, ValueError):
                last_segment_at = None
        if last_segment_at is None and isinstance(raw, dict):
            last_str = raw.get("lastSegmentTime") or raw.get("lastUpdated")
            if isinstance(last_str, str):
                try:
                    last_segment_at = datetime.fromisoformat(
                        last_str.replace("Z", "+00:00")
                    )
                except ValueError:
                    last_segment_at = None

        formatted_participants = None
        if not text_only and include_speakers and meeting.participants:
            formatted_participants = []
            for i, p in enumerate(meeting.participants):
                formatted_p = {
                    "id": p.get("id") or f"participant-{i}",
                    "name": p.get("name", "Unknown"),
                    "email": p.get("email"),
                    "joined_at": p.get("joinedAt")
                    or p.get("joined_at")
                    or datetime.now(UTC).isoformat(),
                    "left_at": p.get("leftAt") or p.get("left_at"),
                    "is_present": p.get("isPresent", True) or p.get("is_present", True),
                }
                formatted_participants.append(formatted_p)

        return MeetingTranscriptResponse(
            meeting_id=meeting.id,
            status=meeting.status,
            transcript=formatted_transcript,
            participants=formatted_participants,
            last_updated=meeting.updated_at,
            last_segment_at=last_segment_at,
            total_duration=_calculate_duration(
                meeting.bot_join_time, meeting.bot_leave_time
            ),
        )

    except MeetingNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to get meeting transcript: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/meetings/list", response_model=MeetingListResponse)
async def list_meetings(
    org_id: Optional[str] = None,
    status: Optional[str] = None,
    since: Optional[datetime] = None,
    until: Optional[datetime] = None,
    limit: int = 50,
    offset: int = 0,
    meeting_service: MeetingService = Depends(get_meeting_service),
):
    """Paginated, filterable historical+active meeting list for the dashboard.

    Args:
        org_id: Restrict to a single organization.
        status: Comma-separated subset of {not_joined, ongoing, completed}.
        since: Lower bound on ``created_at`` (inclusive).
        until: Upper bound on ``created_at`` (inclusive).
        limit: Page size, clamped to [1, 200].
        offset: Page offset (0-indexed).

    Returns:
        ``MeetingListResponse`` with newest-first rows + total count + an
        opaque cursor pointing at the next offset (null when exhausted).
    """
    try:
        statuses = None
        if status:
            valid = {s.value for s in MeetingStatus}
            requested = [s.strip() for s in status.split(",") if s.strip()]
            unknown = [s for s in requested if s not in valid]
            if unknown:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unknown status values: {unknown}. Valid: {sorted(valid)}",
                )
            statuses = [MeetingStatus(s) for s in requested]

        if limit < 1 or limit > 200:
            raise HTTPException(
                status_code=400, detail="limit must be between 1 and 200"
            )
        if offset < 0:
            raise HTTPException(status_code=400, detail="offset must be >= 0")

        meetings = await meeting_service.list_meetings(
            org_id=org_id,
            statuses=statuses,
            since=since,
            until=until,
            limit=limit,
            offset=offset,
        )
        total = await meeting_service.count_meetings(
            org_id=org_id, statuses=statuses, since=since, until=until
        )

        items = [
            MeetingListItem(
                meeting_id=m.id,
                status=m.status,
                meeting_url=m.meeting_url,
                platform=m.platform,
                bot_name=m.bot_name,
                org_id=m.org_id,
                created_at=m.created_at,
                bot_join_time=m.bot_join_time,
                bot_leave_time=m.bot_leave_time,
                duration_seconds=_calculate_duration(m.bot_join_time, m.bot_leave_time),
                participant_count=len(m.participants) if m.participants else 0,
                transcript_entries=(
                    len(m.transcript.get("content", []))
                    if isinstance(m.transcript, dict)
                    else 0
                ),
                video_link=m.video_link,
            )
            for m in meetings
        ]

        next_offset = offset + len(items)
        next_cursor = str(next_offset) if next_offset < total else None

        return MeetingListResponse(meetings=items, next_cursor=next_cursor, total=total)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to list meetings: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/meetings/active")
async def get_active_meetings(
    org_id: Optional[str] = None,
    meeting_service: MeetingService = Depends(get_meeting_service),
):
    """Get list of currently active meetings"""
    try:
        active_meetings = await meeting_service.get_active_meetings(org_id)
        return {
            "active_meetings": len(active_meetings),
            "meetings": [
                {
                    "meeting_id": m.id,
                    "meeting_url": m.meeting_url,
                    "status": m.status,
                    "bot_join_time": m.bot_join_time,
                    "org_id": m.org_id,
                }
                for m in active_meetings
            ],
        }
    except Exception as e:
        logger.error(f"Failed to get active meetings: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/meetings/{meeting_id}/recording-started")
async def notify_recording_started(
    meeting_id: str,
    meeting_service: MeetingService = Depends(get_meeting_service),
):
    """
    Notify that recording has started for a Zoom meeting
    This endpoint is called by the Zoom bot when recording begins
    """
    try:
        logger.info(f"Recording started notification for meeting: {meeting_id}")

        # Get the meeting to verify it exists
        meeting = await meeting_service.get_meeting_by_id(meeting_id)
        if not meeting:
            raise MeetingNotFoundError(f"Meeting {meeting_id} not found")

        # Update the meeting status to indicate recording has started
        # This is important for the status checker to properly track state transitions
        await meeting_service.update_meeting_status(meeting_id, MeetingStatus.ONGOING)

        # Also update the meetings table via the core MeetingsCrud to trigger status transition
        try:
            from core.Meetings import MeetingsCrud
            from db.prisma_client import prisma

            meeting_crud = MeetingsCrud(prisma, logger)

            # Find the main meeting record by matching meeting_joiner.meeting_id
            main_meeting = None
            if hasattr(meeting, "meeting_id") and meeting.meeting_id:
                main_meeting = await meeting_crud.get_meeting_by_id(meeting.meeting_id)

            if main_meeting and main_meeting.analysis_status == "meeting_initiated":
                # Update the main meeting status to "meeting_started" when recording begins
                await meeting_crud.update_meeting(
                    main_meeting.meeting_id, {"analysis_status": "meeting_started"}
                )
                logger.info(
                    f"✅ Updated main meeting {main_meeting.meeting_id} status to meeting_started"
                )
            else:
                logger.info(
                    f"Main meeting not found or not in meeting_initiated state for meeting_joiner {meeting_id}"
                )

        except Exception as e:
            logger.warning(f"Could not update main meeting status: {e}")

        return {
            "message": "Recording start notification received",
            "meeting_id": meeting_id,
            "status": "recording",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    except MeetingNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to process recording start notification: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.delete("/meetings/{meeting_id}")
async def cancel_meeting(
    meeting_id: str,
    meeting_service: MeetingService = Depends(get_meeting_service),
    queue_service=Depends(get_queue_service),
):
    """Cancel a meeting (if not yet started) or stop an ongoing meeting"""
    try:
        meeting = await meeting_service.get_meeting_by_id(meeting_id)
        if not meeting:
            raise MeetingNotFoundError(f"Meeting {meeting_id} not found")

        if meeting.status == "not_joined":
            # Meeting hasn't started yet - just mark as completed
            await meeting_service.update_meeting_status(
                meeting_id, MeetingStatus.COMPLETED
            )
            return {"message": "Meeting cancelled successfully"}
        elif meeting.status in ("ongoing", "joining", "interrupted"):
            logger.info(
                f"Stopping active meeting {meeting_id} (status={meeting.status})"
            )

            # Warm-pool path: the bot runs inside the claimed pod's sidecar
            # subprocess, so the only way to make it leave is the sidecar
            # /abort (the legacy bridge has no handle to it). If the meeting
            # has a pod assigned, abort via the warm pool, mark completed, done.
            pod_name = getattr(meeting, "pod_name", None)
            if pod_name:
                try:
                    warm_pool = await get_warm_pool()
                    acked = False
                    if warm_pool is not None:
                        acked = await warm_pool.abort_meeting_pod(
                            pod_name, reason="user_stop"
                        )
                    await meeting_service.update_meeting_status(
                        meeting_id, MeetingStatus.COMPLETED
                    )
                    return {
                        "message": "Meeting stopped"
                        + ("" if acked else " (sidecar abort not acked; pod deleted)"),
                        "pod_name": pod_name,
                    }
                except Exception as e:
                    logger.warning(
                        f"Warm-pool abort failed for {meeting_id}: {e}; "
                        "falling back to bridge stop"
                    )

            # Legacy (no pod / non-warm-pool) path — meeting processor bridge.
            # Import here to avoid circular imports
            from .services.meeting_processor_bridge import meeting_processor_bridge

            # Use the meeting processor bridge to stop the meeting (handles both Zoom and Teams)
            stop_result = await meeting_processor_bridge.stop_meeting(meeting_id)

            if stop_result.get("success"):
                # Update status after successful termination
                await meeting_service.update_meeting_status(
                    meeting_id, MeetingStatus.COMPLETED
                )
                return {
                    "message": stop_result.get(
                        "message", "Meeting stopped successfully"
                    ),
                    "platform": stop_result.get("platform"),
                }
            else:
                # Fallback: send stop signal through queue service
                if queue_service:
                    try:
                        await queue_service.queue_meeting_stop(meeting_id)
                        return {"message": "Meeting stop signal sent"}
                    except Exception as e:
                        logger.warning(
                            f"Failed to send stop signal for meeting {meeting_id}: {e}"
                        )

                await meeting_service.update_meeting_status(
                    meeting_id, MeetingStatus.COMPLETED
                )
                return {
                    "message": f"Meeting marked as stopped ({stop_result.get('error', 'stop failed')})"
                }
        else:
            return {"message": "Meeting already completed"}

    except MeetingNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to cancel meeting: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# Helper functions
def _is_valid_teams_url(url: str) -> bool:
    """Validate if URL is a valid Microsoft Teams meeting URL (legacy function)"""
    return PlatformDetector.detect_platform(url) == "msteams"


def _is_valid_meeting_url(url: str) -> bool:
    """Validate if URL is from any supported meeting platform"""
    return PlatformDetector.is_valid_meeting_url(url)


def _calculate_duration(start_time, end_time) -> Optional[int]:
    """Calculate duration in seconds between two timestamps"""
    if not start_time or not end_time:
        return None
    return int((end_time - start_time).total_seconds())


if __name__ == "__main__":
    uvicorn.run(
        app,
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower(),
    )
