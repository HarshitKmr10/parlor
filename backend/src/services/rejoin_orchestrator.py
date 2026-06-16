"""Rejoin orchestrator — drives bot recovery after a recoverable drop.

Called from three places:

1. **Sidecar `/abort` callback** when the bot reports a recoverable exit
   reason (`trackGone`, `network_error`, `platform_disconnect`,
   `subprocess_crash`).
2. **Warm pool reaper** when it deletes a pod marked `stuck` for a meeting
   that hasn't reached a terminal state.
3. **K8s pod-deletion informer** (Phase 6) when a node is drained and the
   pod is force-evicted mid-meeting.

Behaviour:

- Increment session_number, claim a new warm pod, sidecar `/configure` with
  same `meeting_id` and `session_number=N+1`, transition
  `interrupted → joining → ongoing` once the new bot is admitted.
- Bounded by ``MAX_SESSIONS_PER_MEETING`` (config) and
  ``MAX_REJOIN_WINDOW_S`` — don't rejoin if the meeting has been silent
  for too long (likely the real meeting ended).
- On rejoin failure (no warm pod, sidecar reject, admission timeout),
  meeting moves to ``failed`` with the rejoin attempt count in details.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional

from src.api.models.schemas import MeetingStatus
from src.observability import get_logger
from src.services.meeting_service import MeetingService
from src.services.meeting_state_machine import (
    InvalidTransitionError,
    classify_exit_reason,
    is_terminal,
    next_status_for_exit,
    validate_transition,
)
from src.services.warm_pool_dispatcher import (
    SidecarConfigurePayload,
    dispatch_to_warm_pool,
)
from src.storage.sessions_repo import get_sessions_repo

logger = get_logger(__name__)

MAX_SESSIONS_PER_MEETING = int(os.environ.get("MAX_SESSIONS_PER_MEETING", "5"))
MAX_REJOIN_WINDOW_S = int(os.environ.get("MAX_REJOIN_WINDOW_S", "600"))


@dataclass(frozen=True)
class RejoinDecision:
    """The outcome of evaluating a rejoin trigger."""

    will_rejoin: bool
    reason: str
    next_status: MeetingStatus
    attempt_number: Optional[int] = None


@dataclass(frozen=True)
class RejoinResult:
    """The outcome of an actual rejoin attempt."""

    success: bool
    new_pod_name: Optional[str]
    new_session_number: Optional[int]
    error: Optional[str] = None


class RejoinOrchestrator:
    """Stateless coordinator — all state lives in DB rows + warm pool."""

    def __init__(self, meeting_service: MeetingService) -> None:
        self._meeting_service = meeting_service
        self._sessions = get_sessions_repo()

    async def evaluate(
        self, meeting_id: str, exit_reason: Optional[str]
    ) -> RejoinDecision:
        """Decide whether to rejoin without performing the rejoin.

        Pure decision-only API so callers (sidecar webhook, reaper) can
        log the rationale before acting. The companion :meth:`attempt`
        actually performs the rejoin.
        """
        classification = classify_exit_reason(exit_reason)
        next_status = next_status_for_exit(MeetingStatus.ONGOING, exit_reason)

        if classification != "recoverable":
            return RejoinDecision(
                will_rejoin=False,
                reason=f"exit_classification={classification}",
                next_status=next_status,
            )

        meeting = await self._meeting_service.get_meeting_by_id(meeting_id)
        if meeting is None:
            return RejoinDecision(
                will_rejoin=False,
                reason="meeting_not_found",
                next_status=MeetingStatus.FAILED,
            )

        if is_terminal(MeetingStatus(meeting.status)):
            return RejoinDecision(
                will_rejoin=False,
                reason="already_terminal",
                next_status=MeetingStatus(meeting.status),
            )

        existing_sessions = await self._sessions.count_sessions(meeting_id)
        if existing_sessions >= MAX_SESSIONS_PER_MEETING:
            return RejoinDecision(
                will_rejoin=False,
                reason="max_sessions_exceeded",
                next_status=MeetingStatus.FAILED,
                attempt_number=existing_sessions,
            )

        latest = await self._sessions.get_latest_session(meeting_id)
        if latest is not None and latest.last_segment_ts is not None:
            silent_for = datetime.now(timezone.utc) - latest.last_segment_ts
            if silent_for > timedelta(seconds=MAX_REJOIN_WINDOW_S):
                return RejoinDecision(
                    will_rejoin=False,
                    reason="meeting_likely_ended_silent_too_long",
                    next_status=MeetingStatus.COMPLETED,
                    attempt_number=existing_sessions,
                )

        return RejoinDecision(
            will_rejoin=True,
            reason="recoverable_drop_within_window",
            next_status=MeetingStatus.INTERRUPTED,
            attempt_number=existing_sessions + 1,
        )

    async def attempt(
        self,
        *,
        meeting_id: str,
        exit_reason: Optional[str],
        dropped_pod_name: Optional[str] = None,
    ) -> RejoinResult:
        """Perform the full rejoin sequence.

        1. Close the old session with the exit reason.
        2. Mark the meeting as `interrupted`.
        3. Decide whether to rejoin (delegates to :meth:`evaluate`).
        4. Claim a new warm pod + sidecar /configure with session_number+1.
        5. Mark the meeting as `joining` (sidecar will flip to `ongoing`
           when the bot is admitted).
        """
        # SINGLE-FLIGHT GUARD. Three triggers can fire a rejoin for the same
        # meeting — the bot's session-ended callback, the ghost-pod reaper,
        # and the warm-pool manager. Without coordination they each passed the
        # session-count check and dispatched their own pod, stacking multiple
        # bots in the same meeting lobby (observed: 4 simultaneous lobby bots,
        # sessions 3-6 created in one 30s burst). Atomically claim the meeting
        # (flip ongoing/joining -> interrupted in one row-locked UPDATE); only
        # the winner proceeds, concurrent triggers bail here.
        claimed = await self._meeting_service.claim_for_rejoin(meeting_id)
        if not claimed:
            logger.info(
                "rejoin.skipped_already_claimed_or_terminal",
                meeting_id=meeting_id,
                exit_reason=exit_reason,
            )
            return RejoinResult(
                success=False,
                new_pod_name=None,
                new_session_number=None,
                error="rejoin_already_in_progress",
            )

        # Always close the dropped session first so the DB reflects reality
        # even if we decide NOT to rejoin.
        latest = await self._sessions.get_latest_session(meeting_id)
        if latest is not None and latest.ended_at is None:
            classification = classify_exit_reason(exit_reason)
            await self._sessions.close_session(
                latest.id,
                exit_reason=exit_reason or "unknown",
                exit_classification=classification,
            )

        decision = await self.evaluate(meeting_id, exit_reason)
        logger.info(
            "rejoin.decision",
            meeting_id=meeting_id,
            will_rejoin=decision.will_rejoin,
            reason=decision.reason,
            next_status=decision.next_status.value,
        )

        meeting = await self._meeting_service.get_meeting_by_id(meeting_id)
        if meeting is None:
            return RejoinResult(
                success=False,
                new_pod_name=None,
                new_session_number=None,
                error="meeting_not_found",
            )

        if not decision.will_rejoin:
            await self._transition_meeting(
                meeting_id=meeting_id,
                current=MeetingStatus(meeting.status),
                target=decision.next_status,
            )
            return RejoinResult(
                success=False,
                new_pod_name=None,
                new_session_number=None,
                error=decision.reason,
            )

        # NOTE: the meeting is already parked in `interrupted` by the
        # single-flight claim above (claim_for_rejoin), so we don't re-transition
        # here — interrupted -> interrupted is not a valid state-machine move.

        new_session_number = (decision.attempt_number or 1)
        # RCA #37: `meeting.platform` is not persisted to the
        # meeting_joiner table — it's computed from the URL at
        # create-time. On rejoin the MeetingRecord's platform is None,
        # which makes the warm-pool dispatcher reject the claim with
        # `warm_pool.invalid_platform`. Re-derive from the URL.
        platform = meeting.platform
        if not platform:
            from src.shared.platformDetector import PlatformDetector
            platform = PlatformDetector.detect_platform(meeting.meeting_url or "")
        payload = SidecarConfigurePayload(
            meeting_id=str(meeting_id),
            meeting_url=meeting.meeting_url,
            org_id=str(meeting.org_id) if meeting.org_id else "",
            platform=platform,
            bot_name=meeting.bot_name or "Meeting Bot",
            session_number=new_session_number,
            transcript_source=meeting.transcript_source,
        )
        dispatch = await dispatch_to_warm_pool(payload)
        if not dispatch.success:
            await self._transition_meeting(
                meeting_id=meeting_id,
                current=MeetingStatus.INTERRUPTED,
                target=MeetingStatus.FAILED,
            )
            return RejoinResult(
                success=False,
                new_pod_name=dispatch.pod_name,
                new_session_number=None,
                error=dispatch.error,
            )

        # Open the new session row pointing at the new pod.
        await self._sessions.open_session(
            meeting_joiner_id=meeting_id,
            pod_name=dispatch.pod_name,
            cluster_name=os.environ.get("CLUSTER_NAME"),
        )
        await self._meeting_service.update_meeting_pod(
            meeting_id,
            dispatch.pod_name,
            cluster_name=os.environ.get("CLUSTER_NAME"),
        )
        await self._transition_meeting(
            meeting_id=meeting_id,
            current=MeetingStatus.INTERRUPTED,
            target=MeetingStatus.JOINING,
        )

        logger.info(
            "rejoin.success",
            meeting_id=meeting_id,
            new_pod_name=dispatch.pod_name,
            new_session_number=new_session_number,
            dropped_pod_name=dropped_pod_name,
        )
        return RejoinResult(
            success=True,
            new_pod_name=dispatch.pod_name,
            new_session_number=new_session_number,
        )

    async def _transition_meeting(
        self,
        *,
        meeting_id: str,
        current: MeetingStatus,
        target: MeetingStatus,
    ) -> None:
        """Run a state-machine-validated status update.

        Swallows :class:`InvalidTransitionError` and logs — the caller
        usually can't do anything useful with a bad transition (it means
        another writer already moved the meeting), but we still want the
        rejoin flow to continue.
        """
        try:
            validate_transition(current, target)
        except InvalidTransitionError as e:
            logger.warning(
                "rejoin.transition_skipped",
                meeting_id=meeting_id,
                current=current.value,
                target=target.value,
                error=str(e),
            )
            return
        await self._meeting_service.update_meeting_status(meeting_id, target)
