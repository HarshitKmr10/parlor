"""Dispatch a meeting onto a separate compose meeting-worker container.

This is the THIRD dispatch mode, alongside the in-process ``LocalBotRunner``
(``RUNTIME_MODE=standalone``) and the K8s warm pool (``RUNTIME_MODE=k8s``).

In ``RUNTIME_MODE=compose`` the bot does NOT run in-process in the API. It runs
in its own ``meeting-worker`` container whose entrypoint is the sidecar FastAPI
app (``src.sidecar.main``). The API hands the meeting to that worker over HTTP
by POSTing the same :class:`SidecarConfigurePayload` to the worker's
``/configure`` endpoint — exactly the wire contract the K8s warm pool uses,
except the target is a fixed compose service URL instead of a claimed pod IP.

This mirrors production (API and bot in separate containers / pods) while
staying K8s-free for local dev.

Concurrency: one worker container handles one concurrent meeting (the sidecar
rejects ``/configure`` with 409 unless it is ``warm``). ``MEETING_WORKER_SIDECAR_URL``
may be a comma-separated list of worker URLs to run a small local pool; we pick
an idle one tracked by an in-flight set. Default is a single worker — real
concurrency at scale comes from the K8s warm pool via Helm.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from threading import Lock
from typing import List, Optional

import httpx

from src.observability import get_logger
from src.services.warm_pool_dispatcher import SidecarConfigurePayload

logger = get_logger(__name__)

CONFIGURE_TIMEOUT_S = float(
    os.environ.get("MEETING_WORKER_CONFIGURE_TIMEOUT_S", "10")
)
HEALTH_TIMEOUT_S = float(
    os.environ.get("MEETING_WORKER_HEALTH_TIMEOUT_S", "4")
)

# Module-level in-flight tracking so repeat dispatches in the same API process
# spread across the configured workers instead of hammering the first one.
_inflight: set[str] = set()
_inflight_lock = Lock()


@dataclass(frozen=True)
class ComposeDispatchResult:
    """Outcome of a compose-worker dispatch attempt.

    ``success`` — worker accepted ``/configure``; caller should mark the
    meeting ``joining`` and let the worker/bot drive the rest.
    ``mark_meeting_failed`` — terminal failure (no worker configured, all
    workers busy, worker unreachable, or worker rejected); caller should mark
    the meeting ``failed`` with ``error`` as the exit reason. We never crash
    the API path.
    """

    success: bool
    worker_url: Optional[str]
    error: Optional[str] = None
    mark_meeting_failed: bool = False


def _worker_urls() -> List[str]:
    """Parse ``MEETING_WORKER_SIDECAR_URL`` into a clean list of base URLs.

    Accepts a single URL or a comma-separated list. Trailing slashes are
    stripped so we can append ``/configure`` deterministically.
    """
    raw = os.environ.get("MEETING_WORKER_SIDECAR_URL", "")
    urls = [u.strip().rstrip("/") for u in raw.split(",") if u.strip()]
    return urls


def is_configured() -> bool:
    """True when at least one meeting-worker URL is configured."""
    return len(_worker_urls()) > 0


async def _worker_is_busy(url: str) -> bool:
    """Authoritative busy check via the worker sidecar's REAL state.

    The in-memory ``_inflight`` set leaks if a bot exits without a
    session-ended callback (and is wiped on every API restart), which left the
    single worker wrongly stuck "busy" forever → ``meeting_worker_all_busy``.
    The sidecar's ``/health`` is the source of truth: a worker is busy only
    when it actually has an active meeting / live bot subprocess. Unreachable
    → treated as busy (fail-safe: never double-book a worker we can't see).
    """
    try:
        async with httpx.AsyncClient(timeout=HEALTH_TIMEOUT_S) as client:
            resp = await client.get(f"{url}/health")
            resp.raise_for_status()
            data = resp.json()
        return bool(data.get("current_meeting_id")) or bool(
            data.get("bot_subprocess_alive")
        )
    except Exception as exc:  # noqa: BLE001 — unreachable worker = unavailable
        logger.warning("compose_worker.health_check_failed", worker=url, error=str(exc))
        return True


async def _claim_idle_worker() -> Optional[str]:
    """Pick a worker whose sidecar reports no active meeting and mark it busy.

    Health-authoritative so a leaked in-flight slot (bot exited without a
    session-ended callback, or an API restart) self-heals instead of pinning
    the worker as permanently busy. Returns ``None`` only when every worker is
    genuinely handling a meeting (or unreachable).
    """
    for url in _worker_urls():
        if not await _worker_is_busy(url):
            with _inflight_lock:
                _inflight.add(url)
            return url
    return None


def _release_worker(url: str) -> None:
    with _inflight_lock:
        _inflight.discard(url)


async def _post_configure(worker_url: str, payload: SidecarConfigurePayload) -> None:
    """POST ``/configure`` to the worker's sidecar.

    Raises ``httpx.HTTPError`` on transport failure or a non-2xx response. The
    sidecar returns 202 ACCEPTED on success (see ``src/sidecar/main.py``).
    """
    url = f"{worker_url}/configure"
    async with httpx.AsyncClient(timeout=CONFIGURE_TIMEOUT_S) as client:
        response = await client.post(url, json=payload.to_json())
        response.raise_for_status()


async def dispatch_to_compose_worker(
    payload: SidecarConfigurePayload,
) -> ComposeDispatchResult:
    """Hand a meeting to a separate compose meeting-worker over HTTP.

    Never raises — every failure is mapped to a ``ComposeDispatchResult`` with
    ``mark_meeting_failed=True`` so the API marks the meeting ``failed`` with a
    clear ``exit_reason`` instead of 500-ing.
    """
    if not is_configured():
        logger.warning(
            "compose_worker.not_configured",
            meeting_id=payload.meeting_id,
        )
        return ComposeDispatchResult(
            success=False,
            worker_url=None,
            error="meeting_worker_not_configured",
            mark_meeting_failed=True,
        )

    worker_url = await _claim_idle_worker()
    if worker_url is None:
        logger.warning(
            "compose_worker.all_busy",
            meeting_id=payload.meeting_id,
            workers=_worker_urls(),
        )
        return ComposeDispatchResult(
            success=False,
            worker_url=None,
            error="meeting_worker_all_busy",
            mark_meeting_failed=True,
        )

    try:
        logger.info(
            "compose_worker.dispatch_attempt",
            meeting_id=payload.meeting_id,
            worker_url=worker_url,
            platform=payload.platform,
            session_number=payload.session_number,
        )
        await _post_configure(worker_url, payload)
    except httpx.HTTPStatusError as exc:
        # The worker is reachable but refused the meeting (e.g. 409 not warm,
        # 422 unsupported platform, 503 missing secrets). Release the worker so
        # it can be retried, and mark the meeting failed with the status.
        _release_worker(worker_url)
        status_code = exc.response.status_code
        logger.warning(
            "compose_worker.configure_rejected",
            meeting_id=payload.meeting_id,
            worker_url=worker_url,
            status_code=status_code,
            error=str(exc),
        )
        return ComposeDispatchResult(
            success=False,
            worker_url=worker_url,
            error=f"meeting_worker_rejected_{status_code}",
            mark_meeting_failed=True,
        )
    except httpx.HTTPError as exc:
        # Transport error / timeout — worker unreachable. Release and fail.
        _release_worker(worker_url)
        logger.warning(
            "compose_worker.unreachable",
            meeting_id=payload.meeting_id,
            worker_url=worker_url,
            error=str(exc),
        )
        return ComposeDispatchResult(
            success=False,
            worker_url=worker_url,
            error="meeting_worker_unreachable",
            mark_meeting_failed=True,
        )

    # NOTE: the worker is freed when the bot's session ends. The sidecar drives
    # heartbeats and the bot writes transcripts to the shared DB; the meeting's
    # terminal transition arrives via the /internal/sessions/ended callback or
    # the status checker. We keep the worker marked in-flight for the lifetime
    # of this API process's view; a follow-up session-ended hook releases it.
    logger.info(
        "compose_worker.dispatch_success",
        meeting_id=payload.meeting_id,
        worker_url=worker_url,
        platform=payload.platform,
        session_number=payload.session_number,
    )
    return ComposeDispatchResult(success=True, worker_url=worker_url)


def release_worker_for_meeting_url(worker_url: Optional[str]) -> None:
    """Release a worker back to the idle set (called on session-ended).

    Exposed so the sessions callback / completion path can free a worker when
    its meeting ends. Safe to call with ``None`` or an unknown URL.
    """
    if worker_url:
        _release_worker(worker_url)
