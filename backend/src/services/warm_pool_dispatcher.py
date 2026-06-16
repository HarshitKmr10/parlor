"""Dispatch a meeting onto a warm-pool pod.

The API's ``POST /meetings`` handler used to enqueue PGQueuer jobs and let a
long-lived worker pick them up. In the warm-pool model this is replaced with
an atomic compare-and-swap claim on a pre-warmed pod plus an HTTP
``/configure`` call to its sidecar. The sidecar then spawns the bot.

Failure mode (no warm pod available) falls back to the legacy PGQueuer path
so a customer cluster that hasn't yet enabled the warm pool keeps working.
This file is the single seam between the new and old worlds — every other
service stays the same.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional

import httpx

from src.observability import get_logger
from src.services.warm_pool_manager import ClaimedPod, get_warm_pool

logger = get_logger(__name__)

SIDECAR_CONFIGURE_TIMEOUT_S = float(
    os.environ.get("MEETING_JOINER_SIDECAR_CONFIGURE_TIMEOUT_S", "10")
)
SIDECAR_PORT = int(os.environ.get("MEETING_JOINER_SIDECAR_PORT", "8080"))


@dataclass(frozen=True)
class DispatchResult:
    """Outcome of dispatch attempt — caller decides what to write to the DB."""

    success: bool
    pod_name: Optional[str]
    pod_ip: Optional[str]
    fallback_to_queue: bool
    error: Optional[str] = None
    release_claim_for_retry: bool = False
    mark_meeting_failed: bool = False


@dataclass(frozen=True)
class SidecarConfigurePayload:
    """The minimal contract with src/sidecar — kept here to avoid a runtime
    coupling to the sidecar package (the API doesn't import sidecar code)."""

    meeting_id: str
    meeting_url: str
    org_id: str
    platform: str
    bot_name: str
    session_number: int
    transcript_source: Optional[str] = None
    bot_avatar_url: Optional[str] = None
    webhook_url: Optional[str] = None
    max_duration_seconds: Optional[int] = None

    def to_json(self) -> dict:
        payload: dict[str, object] = {
            "meeting_id": self.meeting_id,
            "meeting_url": self.meeting_url,
            "org_id": self.org_id,
            "platform": self.platform,
            "bot_name": self.bot_name,
            "session_number": self.session_number,
        }
        if self.transcript_source is not None:
            payload["transcript_source"] = self.transcript_source
        if self.bot_avatar_url is not None:
            payload["bot_avatar_url"] = self.bot_avatar_url
        if self.webhook_url is not None:
            payload["webhook_url"] = self.webhook_url
        if self.max_duration_seconds is not None:
            payload["max_duration_seconds"] = self.max_duration_seconds
        return payload


async def _post_configure(pod: ClaimedPod, payload: SidecarConfigurePayload) -> None:
    """Send /configure to the sidecar of the claimed pod.

    Raises ``httpx.HTTPError`` on any non-2xx — the caller decides whether to
    surrender the pod back to the pool or escalate.
    """
    url = f"http://{pod.pod_ip}:{SIDECAR_PORT}/configure"
    async with httpx.AsyncClient(timeout=SIDECAR_CONFIGURE_TIMEOUT_S) as client:
        response = await client.post(url, json=payload.to_json())
        response.raise_for_status()


async def dispatch_to_warm_pool(
    payload: SidecarConfigurePayload, *, allow_on_demand: bool = True
) -> DispatchResult:
    """Attempt to claim a warm pod and hand the meeting to its sidecar.

    ``allow_on_demand`` controls the burst-overflow behaviour when the warm
    pool is drained. Background callers (scheduler, rejoin orchestrator) leave
    it ``True`` so a burst spins up dedicated pods in parallel. The inline
    ``POST /meetings`` handler sets it ``False``: creating a pod blocks on
    readiness (~cold start) and the request must not hang past gateway timeouts,
    so it falls back to the async queue instead.

    Return value semantics:
    - ``success=True`` — pod claimed, sidecar accepted /configure; caller
      should write the pod name to ``meeting_joiner.pod_name`` and mark the
      meeting ``ongoing``.
    - ``success=False, fallback_to_queue=True`` — pool empty (cold start);
      caller should enqueue via PGQueuer for the legacy path or imperative
      pod creation.
    - ``success=False, fallback_to_queue=False`` — pool claim succeeded but
      dispatch failed. ``release_claim_for_retry`` tells the scheduler whether
      the DB claim is safe to put back in the due-meeting queue.
    """
    pool = await get_warm_pool()
    if pool is None:
        logger.info(
            "warm_pool_unavailable",
            reason="warm_pool_disabled_or_compose_mode",
            meeting_id=payload.meeting_id,
        )
        return DispatchResult(
            success=False,
            pod_name=None,
            pod_ip=None,
            fallback_to_queue=True,
            error="warm_pool_unavailable",
        )

    pod = await pool.claim_pod(
        meeting_id=payload.meeting_id, platform=payload.platform
    )
    if pod is None:
        # Warm pool drained (burst). Spin up a dedicated pod on demand before
        # surrendering to the legacy queue worker, which is single-meeting-per-
        # pod and serializes a burst behind one lock. On-demand pods scale the
        # burst out to WARM_POOL_MAX in parallel.
        if allow_on_demand:
            pod = await pool.create_and_claim_pod(
                meeting_id=payload.meeting_id, platform=payload.platform
            )
        if pod is None:
            logger.info(
                "warm_pool_empty_falling_back",
                meeting_id=payload.meeting_id,
                platform=payload.platform,
                on_demand_attempted=allow_on_demand,
            )
            return DispatchResult(
                success=False,
                pod_name=None,
                pod_ip=None,
                fallback_to_queue=True,
                error=(
                    "warm_pool_empty_and_on_demand_at_capacity"
                    if allow_on_demand
                    else "warm_pool_empty"
                ),
            )
        logger.info(
            "warm_pool_on_demand_dispatch",
            meeting_id=payload.meeting_id,
            pod_name=pod.pod_name,
        )

    try:
        await _post_configure(pod, payload)
    except httpx.HTTPStatusError as e:
        logger.warning(
            "sidecar_configure_failed",
            meeting_id=payload.meeting_id,
            pod_name=pod.pod_name,
            error=str(e),
        )
        status_code = e.response.status_code
        # 409 means this claimed pod is not usable for the request before
        # spawn, so the DB claim can be released for another attempt. 422
        # (unsupported platform) and 503 (secret/config validation) are
        # deterministic request/environment failures; releasing them would
        # immediately re-dispatch the same doomed meeting, so callers should
        # mark the meeting failed instead.
        release_claim_for_retry = status_code == 409
        mark_meeting_failed = status_code in {422, 503}
        try:
            await pool.delete_and_replenish(pod.pod_name)
        except Exception as cleanup_err:  # noqa: BLE001
            logger.error(
                "pod_cleanup_failed_after_configure_error",
                pod_name=pod.pod_name,
                error=str(cleanup_err),
            )
        return DispatchResult(
            success=False,
            pod_name=pod.pod_name,
            pod_ip=pod.pod_ip,
            fallback_to_queue=False,
            error=f"sidecar_rejected: {e}",
            release_claim_for_retry=release_claim_for_retry,
            mark_meeting_failed=mark_meeting_failed,
        )
    except httpx.HTTPError as e:
        logger.warning(
            "sidecar_configure_failed_ambiguous",
            meeting_id=payload.meeting_id,
            pod_name=pod.pod_name,
            error=str(e),
        )
        # A timeout or transport error may have happened after the sidecar
        # accepted /configure. Replenish the pod, but do not mark the DB claim
        # retryable; a second dispatch could briefly double-join the meeting.
        try:
            await pool.delete_and_replenish(pod.pod_name)
        except Exception as cleanup_err:  # noqa: BLE001
            logger.error(
                "pod_cleanup_failed_after_configure_error",
                pod_name=pod.pod_name,
                error=str(cleanup_err),
            )
        return DispatchResult(
            success=False,
            pod_name=pod.pod_name,
            pod_ip=pod.pod_ip,
            fallback_to_queue=False,
            error=f"sidecar_configure_uncertain: {e}",
            release_claim_for_retry=False,
        )

    # Design #1 (RCA): update session N's pod_name on the existing audit
    # row so the trail shows where this attempt actually ran. Session 1 is
    # opened by DatabaseConnection.create_meeting() pre-dispatch; sessions
    # 2+ are opened by RejoinOrchestrator.attempt(). Either way the row
    # for session_number=payload.session_number already exists — update it.
    try:
        from ..storage.sessions_repo import get_sessions_repo
        await get_sessions_repo().update_pod_name_for_session(
            meeting_joiner_id=payload.meeting_id,
            session_number=payload.session_number,
            pod_name=pod.pod_name,
        )
    except Exception as e:  # noqa: BLE001
        logger.warning(
            "dispatch.session_pod_update_failed",
            meeting_id=payload.meeting_id,
            session_number=payload.session_number,
            error=str(e),
        )

    logger.info(
        "warm_pool_dispatch_success",
        meeting_id=payload.meeting_id,
        pod_name=pod.pod_name,
        platform=payload.platform,
        session_number=payload.session_number,
    )
    return DispatchResult(
        success=True,
        pod_name=pod.pod_name,
        pod_ip=pod.pod_ip,
        fallback_to_queue=False,
    )
