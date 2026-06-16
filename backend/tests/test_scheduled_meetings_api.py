"""Tests for scheduled meeting dispatch — request validation + endpoint branch.

Covers the `scheduled_at` field validator on MeetingCreateRequest and the
`POST /meetings` behaviour: a future `scheduled_at` registers the meeting in
status `scheduled` WITHOUT dispatching a bot; omitting it dispatches as before.
DB and warm-pool internals are stubbed — this pins the contract, not the wiring.
"""

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError

from src.main import app, dispatch_meeting, get_meeting_service, get_queue_service
from src.api.models.schemas import (
    MeetingCreateRequest,
    MeetingRecord,
    MeetingStatus,
)
from src.services.warm_pool_dispatcher import DispatchResult
from src.db.python.status_enum import STATUSES

UTC = timezone.utc
TEAMS_URL = "https://teams.microsoft.com/l/meetup-join/abc"


# ── status enum registration ────────────────────────────────────────────


def test_scheduled_is_a_valid_status():
    assert "scheduled" in STATUSES
    assert MeetingStatus.SCHEDULED.value == "scheduled"


# ── request validation ──────────────────────────────────────────────────


def _request(scheduled_at):
    return MeetingCreateRequest(meeting_url=TEAMS_URL, scheduled_at=scheduled_at)


def test_scheduled_at_none_is_allowed():
    assert _request(None).scheduled_at is None


def test_future_aware_scheduled_at_is_accepted():
    when = datetime.now(UTC) + timedelta(hours=2)
    assert _request(when).scheduled_at == when


def test_past_scheduled_at_is_rejected():
    when = datetime.now(UTC) - timedelta(minutes=1)
    with pytest.raises(ValidationError, match="must be in the future"):
        _request(when)


def test_naive_scheduled_at_is_rejected():
    when = datetime.now() + timedelta(hours=2)  # no tzinfo
    with pytest.raises(ValidationError, match="timezone offset"):
        _request(when)


def test_scheduled_at_beyond_horizon_is_rejected():
    when = datetime.now(UTC) + timedelta(days=90)
    with pytest.raises(ValidationError, match="days ahead"):
        _request(when)


# ── endpoint behaviour ──────────────────────────────────────────────────


def _record(*, status: MeetingStatus, scheduled_at):
    base = datetime(2026, 6, 5, 10, 0, 0, tzinfo=UTC)
    return MeetingRecord(
        id="m-sched",
        meeting_url=TEAMS_URL,
        status=status,
        platform="msteams",
        org_id=None,
        bot_name="Meeting Bot",
        is_duplicate=False,
        original_meeting_id=None,
        scheduled_at=scheduled_at,
        created_at=base,
        updated_at=base,
    )


@pytest.fixture
def client_with_stubs():
    meeting_stub = AsyncMock()
    queue_stub = AsyncMock()
    app.dependency_overrides[get_meeting_service] = lambda: meeting_stub
    app.dependency_overrides[get_queue_service] = lambda: queue_stub
    try:
        yield TestClient(app), meeting_stub
    finally:
        app.dependency_overrides.pop(get_meeting_service, None)
        app.dependency_overrides.pop(get_queue_service, None)


def test_scheduled_meeting_is_registered_without_dispatch(client_with_stubs):
    client, meeting_stub = client_with_stubs
    when = datetime.now(UTC) + timedelta(hours=3)
    meeting_stub.create_meeting.return_value = _record(
        status=MeetingStatus.SCHEDULED, scheduled_at=when
    )

    with patch("src.main.dispatch_meeting", new=AsyncMock()) as dispatch:
        res = client.post(
            "/meetings",
            json={"meeting_url": TEAMS_URL, "scheduled_at": when.isoformat()},
        )

    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "scheduled"
    assert body["scheduled_at"] is not None
    assert "Scheduled for" in body["message"]
    # The whole point: no bot is dispatched at booking time.
    dispatch.assert_not_awaited()
    # And create_meeting received the scheduled_at.
    assert meeting_stub.create_meeting.await_args.kwargs["scheduled_at"] is not None


def test_immediate_meeting_dispatches(client_with_stubs):
    client, meeting_stub = client_with_stubs
    meeting_stub.create_meeting.return_value = _record(
        status=MeetingStatus.NOT_JOINED, scheduled_at=None
    )

    with patch(
        "src.main.dispatch_meeting",
        new=AsyncMock(return_value=(True, "Dispatched to warm-pool pod p-1")),
    ) as dispatch:
        res = client.post("/meetings", json={"meeting_url": TEAMS_URL})

    assert res.status_code == 200
    body = res.json()
    assert body["scheduled_at"] is None
    dispatch.assert_awaited_once()


def test_immediate_meeting_preserves_dispatch_http_exception(client_with_stubs):
    client, meeting_stub = client_with_stubs
    meeting_stub.create_meeting.return_value = _record(
        status=MeetingStatus.NOT_JOINED, scheduled_at=None
    )

    error_detail = {
        "message": "Warm pool dispatch failed",
        "retry_after_seconds": 5,
    }
    with patch(
        "src.main.dispatch_meeting",
        new=AsyncMock(side_effect=HTTPException(status_code=503, detail=error_detail)),
    ):
        res = client.post("/meetings", json={"meeting_url": TEAMS_URL})

    assert res.status_code == 503
    assert res.json()["detail"] == error_detail


@pytest.mark.asyncio
async def test_dispatch_meeting_marks_deterministic_warm_pool_rejection_failed():
    meeting_service = AsyncMock()
    queue_service = AsyncMock()
    result = DispatchResult(
        success=False,
        pod_name="meeting-worker-abc",
        pod_ip="10.0.0.1",
        fallback_to_queue=False,
        error="sidecar_rejected: missing secrets",
        mark_meeting_failed=True,
    )

    with patch(
        "src.main.dispatch_to_warm_pool",
        new=AsyncMock(return_value=result),
    ):
        with pytest.raises(HTTPException) as excinfo:
            await dispatch_meeting(
                meeting_id="m-1",
                meeting_url=TEAMS_URL,
                platform="msteams",
                transcript_source="audio_asr",
                bot_name="Meeting Bot",
                org_id=None,
                meeting_service=meeting_service,
                queue_service=queue_service,
            )

    meeting_service.update_meeting_status.assert_awaited_once_with(
        "m-1", MeetingStatus.FAILED
    )
    assert excinfo.value.status_code == 503
    assert getattr(excinfo.value, "mark_meeting_failed") is True
