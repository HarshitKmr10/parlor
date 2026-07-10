"""Tests for the /meetings/list dashboard endpoint.

Exercises the route's validation + filter parsing using FastAPI's TestClient
with the meeting_service dependency stubbed. Heavy DB integration is covered
by the service-level + db-level tests; this file pins the route contract.
"""

from datetime import datetime, timedelta, timezone
from typing import List, Optional
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from src.main import app, get_meeting_service
from src.api.models.schemas import MeetingRecord, MeetingStatus
from src.api.product.deps import AuthContext, get_current_context
from src.api.product.schemas import Workspace

UTC = timezone.utc

TEST_WORKSPACE_ID = "org-1"


def _override_context():
    return AuthContext(
        user=None,
        workspace=Workspace(id=TEST_WORKSPACE_ID, name="W", slug="w", role="owner"),
        via_api_key=False,
    )


def _record(
    *,
    id: str,
    status: MeetingStatus = MeetingStatus.COMPLETED,
    bot_join: Optional[datetime] = None,
    bot_leave: Optional[datetime] = None,
    participants: int = 0,
    transcript_entries: int = 0,
) -> MeetingRecord:
    base = datetime(2026, 4, 30, 22, 0, 0, tzinfo=UTC)
    return MeetingRecord(
        id=id,
        meeting_url="https://teams.microsoft.com/meet/" + id,
        status=status,
        platform="msteams",
        video_link=None,
        transcript=(
            {"content": [{"speaker": "spk_0", "content": "x"} for _ in range(transcript_entries)]}
            if transcript_entries
            else None
        ),
        participants=[{"id": f"p-{i}", "name": f"P{i}"} for i in range(participants)] or None,
        org_id="org-1",
        bot_join_time=bot_join,
        bot_leave_time=bot_leave,
        bot_name="Bot",
        is_duplicate=False,
        original_meeting_id=None,
        created_at=base,
        updated_at=base,
    )


@pytest.fixture
def client_with_stub():
    stub = AsyncMock()

    def override():
        return stub

    app.dependency_overrides[get_meeting_service] = override
    app.dependency_overrides[get_current_context] = _override_context
    try:
        yield TestClient(app), stub
    finally:
        app.dependency_overrides.pop(get_meeting_service, None)
        app.dependency_overrides.pop(get_current_context, None)


def test_list_returns_paginated_items_with_duration(client_with_stub):
    client, stub = client_with_stub
    join = datetime(2026, 4, 30, 22, 5, 0, tzinfo=UTC)
    leave = join + timedelta(seconds=125)
    stub.list_meetings.return_value = [
        _record(id="m1", bot_join=join, bot_leave=leave, participants=3, transcript_entries=42),
        _record(id="m2", status=MeetingStatus.ONGOING, bot_join=join, participants=2),
    ]
    stub.count_meetings.return_value = 2

    res = client.get("/meetings/list")
    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 2
    assert len(body["meetings"]) == 2
    assert body["next_cursor"] is None  # exhausted

    completed = body["meetings"][0]
    assert completed["meeting_id"] == "m1"
    assert completed["duration_seconds"] == 125
    assert completed["participant_count"] == 3
    assert completed["transcript_entries"] == 42

    ongoing = body["meetings"][1]
    assert ongoing["meeting_id"] == "m2"
    # Ongoing meetings have null leave time → duration null so the UI
    # can render a live timer instead of a frozen value.
    assert ongoing["duration_seconds"] is None


def test_list_emits_next_cursor_when_more_pages(client_with_stub):
    client, stub = client_with_stub
    stub.list_meetings.return_value = [_record(id=f"m{i}") for i in range(50)]
    stub.count_meetings.return_value = 173

    res = client.get("/meetings/list?limit=50&offset=0")
    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 173
    assert body["next_cursor"] == "50"


def test_list_parses_comma_separated_status(client_with_stub):
    client, stub = client_with_stub
    stub.list_meetings.return_value = []
    stub.count_meetings.return_value = 0

    res = client.get("/meetings/list?status=ongoing,not_joined")
    assert res.status_code == 200
    statuses_arg = stub.list_meetings.call_args.kwargs["statuses"]
    assert statuses_arg == [MeetingStatus.ONGOING, MeetingStatus.NOT_JOINED]


def test_list_rejects_unknown_status(client_with_stub):
    client, _ = client_with_stub
    res = client.get("/meetings/list?status=ongoing,bogus")
    assert res.status_code == 400
    assert "bogus" in res.json()["detail"]


@pytest.mark.parametrize("limit,offset", [(0, 0), (201, 0), (50, -1)])
def test_list_rejects_out_of_range_pagination(client_with_stub, limit, offset):
    client, _ = client_with_stub
    res = client.get(f"/meetings/list?limit={limit}&offset={offset}")
    assert res.status_code == 400


def test_list_ignores_org_id_query_param_and_uses_caller_workspace(client_with_stub):
    """The org_id query param must never be trusted as an identity claim —
    the route always scopes to the authenticated caller's own workspace,
    regardless of what org_id a client passes."""
    client, stub = client_with_stub
    stub.list_meetings.return_value = []
    stub.count_meetings.return_value = 0

    res = client.get(
        "/meetings/list"
        "?org_id=someone-elses-workspace"
        "&since=2026-04-29T00:00:00Z"
        "&until=2026-04-30T23:59:59Z"
    )
    assert res.status_code == 200
    kwargs = stub.list_meetings.call_args.kwargs
    assert kwargs["org_id"] == TEST_WORKSPACE_ID
    assert kwargs["since"] is not None
    assert kwargs["until"] is not None
