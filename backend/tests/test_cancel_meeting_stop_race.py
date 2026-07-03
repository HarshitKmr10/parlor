"""Regression tests for #83: reaper-triggered rejoin racing a user stop.

`DELETE /meetings/{id}` (``cancel_meeting``) reads the meeting's status, then
performs work (warm-pool abort / legacy bridge stop) before writing
``COMPLETED``. If a reaper-triggered rejoin claims the meeting for a
replacement bot in between (flipping it to `interrupted`/`joining`/`ongoing`),
an unconditional `COMPLETED` write would stomp the replacement's in-flight
state and orphan the new pod. These tests assert the handler now goes through
the guarded ``MeetingService.complete_if_active`` (a conditional UPDATE,
mirroring ``claim_for_rejoin``) at every call site, and that a lost race
(guard returns `False`) is surfaced as a skip rather than a false "stopped".
"""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from src.api.models.schemas import MeetingRecord, MeetingStatus
from src.main import app, get_meeting_service, get_queue_service

UTC = timezone.utc


def _record(*, status: MeetingStatus, pod_name: str | None = None) -> MeetingRecord:
    base = datetime(2026, 6, 5, 10, 0, 0, tzinfo=UTC)
    return MeetingRecord(
        id="m-race",
        meeting_url="https://teams.microsoft.com/meet/m-race",
        status=status,
        platform="msteams",
        org_id=None,
        bot_name="Meeting Bot",
        is_duplicate=False,
        original_meeting_id=None,
        pod_name=pod_name,
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


def test_not_joined_cancel_uses_guarded_write(client_with_stubs):
    """The `not_joined` branch must call the guarded write, not the
    unconditional `update_meeting_status(COMPLETED)`."""
    client, meeting_stub = client_with_stubs
    meeting_stub.get_meeting_by_id.return_value = _record(
        status=MeetingStatus.NOT_JOINED
    )
    meeting_stub.complete_if_active.return_value = True

    res = client.delete("/meetings/m-race")

    assert res.status_code == 200
    meeting_stub.complete_if_active.assert_awaited_once_with("m-race")
    meeting_stub.update_meeting_status.assert_not_awaited()


def test_warm_pool_stop_skips_completion_when_meeting_already_reclaimed(
    client_with_stubs,
):
    """Regression for #83 — the exact scenario cited in the issue: a
    reaper-triggered rejoin claims the meeting (guard write matches zero
    rows) between the read and the warm-pool abort. The stale stop request
    must NOT report success or write COMPLETED unconditionally."""
    client, meeting_stub = client_with_stubs
    meeting_stub.get_meeting_by_id.return_value = _record(
        status=MeetingStatus.ONGOING, pod_name="pod-123"
    )
    # Guard loses the race — meeting was already reclaimed for a replacement bot.
    meeting_stub.complete_if_active.return_value = False

    warm_pool = AsyncMock()
    warm_pool.abort_meeting_pod.return_value = True

    with patch("src.main.get_warm_pool", AsyncMock(return_value=warm_pool)):
        res = client.delete("/meetings/m-race")

    assert res.status_code == 200
    body = res.json()
    assert "already" in body["message"].lower()
    meeting_stub.complete_if_active.assert_awaited_once_with("m-race")
    meeting_stub.update_meeting_status.assert_not_awaited()


def test_warm_pool_stop_completes_when_guard_wins(client_with_stubs):
    """Sanity check: when the guard succeeds (no race), the stop still
    reports success as before."""
    client, meeting_stub = client_with_stubs
    meeting_stub.get_meeting_by_id.return_value = _record(
        status=MeetingStatus.ONGOING, pod_name="pod-123"
    )
    meeting_stub.complete_if_active.return_value = True

    warm_pool = AsyncMock()
    warm_pool.abort_meeting_pod.return_value = True

    with patch("src.main.get_warm_pool", AsyncMock(return_value=warm_pool)):
        res = client.delete("/meetings/m-race")

    assert res.status_code == 200
    body = res.json()
    assert body["message"] == "Meeting stopped"
    meeting_stub.complete_if_active.assert_awaited_once_with("m-race")


def test_legacy_bridge_stop_skips_completion_when_meeting_already_reclaimed(
    client_with_stubs,
):
    """Same race on the legacy (no-pod) bridge success path."""
    client, meeting_stub = client_with_stubs
    meeting_stub.get_meeting_by_id.return_value = _record(
        status=MeetingStatus.ONGOING, pod_name=None
    )
    meeting_stub.complete_if_active.return_value = False

    bridge_stop = AsyncMock(
        return_value={"success": True, "message": "stopped", "platform": "msteams"}
    )
    with patch(
        "src.services.meeting_processor_bridge.meeting_processor_bridge.stop_meeting",
        bridge_stop,
    ):
        res = client.delete("/meetings/m-race")

    assert res.status_code == 200
    body = res.json()
    assert "already" in body["message"].lower()
    meeting_stub.complete_if_active.assert_awaited_once_with("m-race")
    meeting_stub.update_meeting_status.assert_not_awaited()


def test_legacy_bridge_fallback_skips_completion_when_meeting_already_reclaimed(
    client_with_stubs,
):
    """Same race on the final fallback path (bridge stop failed, no queue
    service available)."""
    client, meeting_stub = client_with_stubs
    meeting_stub.get_meeting_by_id.return_value = _record(
        status=MeetingStatus.ONGOING, pod_name=None
    )
    meeting_stub.complete_if_active.return_value = False

    bridge_stop = AsyncMock(return_value={"success": False, "error": "no bot handle"})
    with (
        patch(
            "src.services.meeting_processor_bridge.meeting_processor_bridge.stop_meeting",
            bridge_stop,
        ),
        patch("src.main.get_queue_service", AsyncMock(return_value=None)),
    ):
        app.dependency_overrides[get_queue_service] = lambda: None
        res = client.delete("/meetings/m-race")

    assert res.status_code == 200
    body = res.json()
    assert "already" in body["message"].lower()
    meeting_stub.complete_if_active.assert_awaited_once_with("m-race")
    meeting_stub.update_meeting_status.assert_not_awaited()
