"""Unit tests for the rejoin orchestrator.

Two areas of behavioural coverage:
1. :meth:`RejoinOrchestrator.evaluate` — the decision-only API.
2. :meth:`RejoinOrchestrator.attempt` — full sequence with mocked dispatch.

DB and warm-pool interactions are mocked; this is unit, not integration.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.api.models.schemas import MeetingStatus
from src.services.rejoin_orchestrator import (
    MAX_REJOIN_WINDOW_S,
    MAX_SESSIONS_PER_MEETING,
    RejoinOrchestrator,
)
from src.services.warm_pool_dispatcher import DispatchResult
from src.storage.sessions_repo import MeetingSession


def _fake_meeting(
    meeting_id: str = "m-1",
    status: MeetingStatus = MeetingStatus.ONGOING,
    platform: str = "msteams",
) -> MagicMock:
    """Mock of a meeting record with attributes used by the orchestrator."""
    m = MagicMock()
    m.id = meeting_id
    m.status = status.value
    m.platform = platform
    m.meeting_url = "https://teams.microsoft.com/meet/abc"
    m.org_id = "org-1"
    m.bot_name = "Test Bot"
    m.transcript_source = "audio_asr"
    return m


def _fake_session(
    session_number: int = 1,
    last_segment_ago_seconds: int | None = 30,
    ended: bool = False,
) -> MeetingSession:
    now = datetime.now(timezone.utc)
    last_segment_ts = (
        now - timedelta(seconds=last_segment_ago_seconds)
        if last_segment_ago_seconds is not None
        else None
    )
    return MeetingSession(
        id=f"s-{session_number}",
        meeting_joiner_id="m-1",
        session_number=session_number,
        pod_name=f"pod-{session_number}",
        cluster_name="cluster-x",
        started_at=now - timedelta(minutes=5),
        ended_at=now if ended else None,
        admitted_at=now - timedelta(minutes=4),
        exit_reason=None,
        exit_classification=None,
        last_segment_ts=last_segment_ts,
    )


@pytest.fixture
def meeting_service():
    svc = AsyncMock()
    svc.get_meeting_by_id = AsyncMock(return_value=_fake_meeting())
    svc.update_meeting_status = AsyncMock()
    svc.update_meeting_pod = AsyncMock()
    # Single-flight claim succeeds by default (this caller won the rejoin).
    svc.claim_for_rejoin = AsyncMock(return_value=True)
    return svc


@pytest.fixture
def sessions_repo():
    repo = AsyncMock()
    repo.count_sessions = AsyncMock(return_value=1)
    repo.get_latest_session = AsyncMock(return_value=_fake_session())
    repo.open_session = AsyncMock()
    repo.close_session = AsyncMock()
    return repo


@pytest.fixture
def orchestrator(meeting_service, sessions_repo):
    with patch(
        "src.services.rejoin_orchestrator.get_sessions_repo",
        return_value=sessions_repo,
    ):
        yield RejoinOrchestrator(meeting_service=meeting_service)


@pytest.mark.asyncio
@pytest.mark.unit
class TestEvaluate:
    async def test_terminal_exit_does_not_rejoin(
        self, orchestrator, meeting_service
    ) -> None:
        decision = await orchestrator.evaluate("m-1", "removed")

        assert decision.will_rejoin is False
        assert decision.next_status == MeetingStatus.COMPLETED

    async def test_recoverable_exit_within_window_rejoins(
        self, orchestrator
    ) -> None:
        decision = await orchestrator.evaluate("m-1", "trackGone")

        assert decision.will_rejoin is True
        assert decision.next_status == MeetingStatus.INTERRUPTED

    async def test_silent_too_long_does_not_rejoin(
        self, orchestrator, sessions_repo
    ) -> None:
        # Last segment older than window — meeting is likely over.
        sessions_repo.get_latest_session = AsyncMock(
            return_value=_fake_session(
                last_segment_ago_seconds=MAX_REJOIN_WINDOW_S + 60
            )
        )

        decision = await orchestrator.evaluate("m-1", "trackGone")

        assert decision.will_rejoin is False
        assert decision.next_status == MeetingStatus.COMPLETED
        assert "silent_too_long" in decision.reason

    async def test_max_sessions_exceeded(
        self, orchestrator, sessions_repo
    ) -> None:
        sessions_repo.count_sessions = AsyncMock(
            return_value=MAX_SESSIONS_PER_MEETING
        )

        decision = await orchestrator.evaluate("m-1", "trackGone")

        assert decision.will_rejoin is False
        assert decision.next_status == MeetingStatus.FAILED

    async def test_meeting_not_found(
        self, orchestrator, meeting_service
    ) -> None:
        meeting_service.get_meeting_by_id = AsyncMock(return_value=None)

        decision = await orchestrator.evaluate("nonexistent", "trackGone")

        assert decision.will_rejoin is False
        assert decision.reason == "meeting_not_found"

    async def test_already_terminal_meeting(
        self, orchestrator, meeting_service
    ) -> None:
        meeting_service.get_meeting_by_id = AsyncMock(
            return_value=_fake_meeting(status=MeetingStatus.COMPLETED)
        )

        decision = await orchestrator.evaluate("m-1", "trackGone")

        assert decision.will_rejoin is False
        assert decision.next_status == MeetingStatus.COMPLETED


@pytest.mark.asyncio
@pytest.mark.unit
class TestAttempt:
    async def test_successful_rejoin_flow(
        self, orchestrator, meeting_service, sessions_repo
    ) -> None:
        dispatch = DispatchResult(
            success=True,
            pod_name="pod-2",
            pod_ip="10.0.0.2",
            fallback_to_queue=False,
        )
        with patch(
            "src.services.rejoin_orchestrator.dispatch_to_warm_pool",
            new=AsyncMock(return_value=dispatch),
        ):
            result = await orchestrator.attempt(
                meeting_id="m-1", exit_reason="trackGone"
            )

        assert result.success is True
        assert result.new_pod_name == "pod-2"
        assert result.new_session_number == 2  # one existing + this is +1

        sessions_repo.close_session.assert_awaited_once()
        sessions_repo.open_session.assert_awaited_once()
        meeting_service.update_meeting_pod.assert_awaited_once()

    async def test_terminal_exit_closes_session_but_does_not_rejoin(
        self, orchestrator, meeting_service, sessions_repo
    ) -> None:
        with patch(
            "src.services.rejoin_orchestrator.dispatch_to_warm_pool",
            new=AsyncMock(),
        ) as dispatch_mock:
            result = await orchestrator.attempt(
                meeting_id="m-1", exit_reason="max_meeting_time"
            )

        assert result.success is False
        sessions_repo.close_session.assert_awaited_once()
        dispatch_mock.assert_not_called()
        # Should NOT increment session — no new pod was dispatched.
        sessions_repo.open_session.assert_not_called()

    async def test_dispatch_failure_marks_failed(
        self, orchestrator, meeting_service
    ) -> None:
        dispatch = DispatchResult(
            success=False,
            pod_name=None,
            pod_ip=None,
            fallback_to_queue=True,
            error="warm_pool_empty",
        )
        with patch(
            "src.services.rejoin_orchestrator.dispatch_to_warm_pool",
            new=AsyncMock(return_value=dispatch),
        ):
            result = await orchestrator.attempt(
                meeting_id="m-1", exit_reason="trackGone"
            )

        assert result.success is False
        assert result.error == "warm_pool_empty"
        # Status should have been moved to FAILED.
        statuses_passed = [
            call.args[1]
            for call in meeting_service.update_meeting_status.call_args_list
        ]
        assert MeetingStatus.FAILED in statuses_passed

    async def test_single_flight_lost_claim_does_not_rejoin(
        self, orchestrator, meeting_service, sessions_repo
    ) -> None:
        # Another trigger already claimed this rejoin (claim returns False).
        # This attempt must bail immediately: no session close, no dispatch.
        meeting_service.claim_for_rejoin = AsyncMock(return_value=False)
        with patch(
            "src.services.rejoin_orchestrator.dispatch_to_warm_pool",
            new=AsyncMock(),
        ) as dispatch_mock:
            result = await orchestrator.attempt(
                meeting_id="m-1", exit_reason="trackGone"
            )

        assert result.success is False
        assert result.error == "rejoin_already_in_progress"
        dispatch_mock.assert_not_called()
        sessions_repo.open_session.assert_not_called()
        sessions_repo.close_session.assert_not_called()
