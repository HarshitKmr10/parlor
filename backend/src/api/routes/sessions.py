"""Sessions callback API — sidecar → API messaging.

The meeting-worker sidecar calls this when the bot subprocess exits. The
API correlates the exit reason against the state machine, decides whether
to trigger rejoin via :class:`RejoinOrchestrator`, and returns the
decision so the sidecar can log it and proceed (typically: terminate the
pod so the warm-pool reaper deletes it).

Authentication: ``X-Sidecar-Token`` header must match
``SIDECAR_CALLBACK_TOKEN`` env var. This is a single shared secret
provisioned via the External Secret in the Helm chart. Per-pod token
rotation is out of scope for Phase 3.
"""

from __future__ import annotations

import hmac
import os
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from src.api.database.connection import get_db_connection
from src.observability import get_logger
from src.services.meeting_service import MeetingService
from src.services.rejoin_orchestrator import RejoinDecision, RejoinOrchestrator

logger = get_logger(__name__)
router = APIRouter(prefix="/internal/sessions", tags=["internal", "sessions"])


class SessionEndedRequest(BaseModel):
    """Payload from sidecar on bot subprocess exit."""

    meeting_id: str = Field(..., description="UUID of meeting_joiner row")
    session_number: int = Field(..., ge=1)
    pod_name: str
    exit_reason: Optional[str] = Field(
        None, description="Bot's reported exit reason (e.g. 'trackGone')"
    )
    ended_at: Optional[datetime] = None
    details: Optional[dict] = None


class SessionEndedResponse(BaseModel):
    """Returned to the sidecar so it knows what's next."""

    will_rejoin: bool
    next_status: str
    reason: str
    new_pod_name: Optional[str] = None
    new_session_number: Optional[int] = None


async def _verify_sidecar_token(
    x_sidecar_token: Optional[str] = Header(default=None),
) -> None:
    expected = os.environ.get("SIDECAR_CALLBACK_TOKEN")
    if not expected:
        # In dev / compose mode without the token set, accept all calls so
        # local development isn't blocked. Real (non-dev) deployments must
        # set this — shared/secret_validator.py enforces it at boot so a
        # production process without the token fails to start rather than
        # silently accepting unauthenticated callbacks here.
        return
    if not hmac.compare_digest(x_sidecar_token or "", expected):
        raise HTTPException(status_code=401, detail="invalid_sidecar_token")


async def _get_meeting_service() -> MeetingService:
    db = await get_db_connection()
    return MeetingService(db)


@router.post(
    "/ended",
    response_model=SessionEndedResponse,
    status_code=200,
    dependencies=[Depends(_verify_sidecar_token)],
    include_in_schema=False,
    summary="Sidecar session-ended callback",
    description=(
        "Internal callback used by the meeting-worker sidecar when the bot "
        "subprocess exits. Authenticated via the `X-Sidecar-Token` shared "
        "secret, not product auth — not part of the public API surface."
    ),
)
async def session_ended(
    body: SessionEndedRequest,
    meeting_service: MeetingService = Depends(_get_meeting_service),
) -> SessionEndedResponse:
    """Sidecar reports a finished session; API decides what to do next.

    The orchestrator is responsible for:
    - closing the meeting_sessions row with the right classification,
    - transitioning the meeting status,
    - (when recoverable) dispatching a new warm pod for session N+1.

    The sidecar's job after this returns is to terminate its own pod so
    the warm pool can replenish.
    """
    logger.info(
        "session.ended_callback",
        meeting_id=body.meeting_id,
        session_number=body.session_number,
        pod_name=body.pod_name,
        exit_reason=body.exit_reason,
    )

    orchestrator = RejoinOrchestrator(meeting_service=meeting_service)
    result = await orchestrator.attempt(
        meeting_id=body.meeting_id,
        exit_reason=body.exit_reason,
        dropped_pod_name=body.pod_name,
    )

    # The orchestrator returned a RejoinResult; translate to the public
    # response shape. We re-run evaluate() ONLY when the attempt didn't
    # already produce a decision — happens in the "meeting not found" path
    # which is rare and signals data corruption.
    if result.success:
        return SessionEndedResponse(
            will_rejoin=True,
            next_status="joining",
            reason="recoverable_drop_within_window",
            new_pod_name=result.new_pod_name,
            new_session_number=result.new_session_number,
        )

    decision: RejoinDecision = await orchestrator.evaluate(
        body.meeting_id, body.exit_reason
    )
    return SessionEndedResponse(
        will_rejoin=False,
        next_status=decision.next_status.value,
        reason=result.error or decision.reason,
    )
