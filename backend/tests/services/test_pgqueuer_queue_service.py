"""Regression tests for the PGQueuer-based queue service's stop-meeting path.

Covers the fix for the orphaned-bot leak: `process_meeting_stop` must
actually signal the bot to leave the call (via meeting_processor_bridge)
before marking the meeting completed in the DB, and must re-raise (so the
queue retries) instead of silently reporting success when that signal fails.
"""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, patch

import pytest
from pgqueuer import PgQueuer

from src.services.pgqueuer_queue_service import PgQueuerQueueService


class _FakeJob:
    id = "job-1"

    def __init__(self, payload: dict) -> None:
        self.payload = json.dumps(payload).encode()


def _stop_meeting_func(service: PgQueuerQueueService):
    """Pull the raw (undecorated) coroutine function registered for the
    'stop_meeting' entrypoint so it can be invoked directly in tests."""
    executor = service.pgq.qm.entrypoint_registry["stop_meeting"]
    return executor.parameters.func


def _make_service() -> PgQueuerQueueService:
    service = PgQueuerQueueService()
    # A real PgQueuer instance registers entrypoints without touching the DB;
    # the dummy connection object is never used by registration itself.
    service.pgq = PgQueuer(connection=object())
    service._register_meeting_entrypoints()
    return service


@pytest.mark.asyncio
async def test_stop_meeting_signals_bot_before_marking_completed():
    service = _make_service()
    func = _stop_meeting_func(service)
    job = _FakeJob({"meeting_id": "m-1"})

    call_order: list[str] = []

    async def fake_stop_meeting(meeting_id):
        call_order.append("bot_stop")
        assert meeting_id == "m-1"
        return {"success": True, "message": "stopped"}

    async def fake_update_status(meeting_id, status):
        call_order.append("db_update")

    with patch(
        "src.services.meeting_processor_bridge.meeting_processor_bridge.stop_meeting",
        new=AsyncMock(side_effect=fake_stop_meeting),
    ) as bridge_stop, patch(
        "src.api.database.connection.get_db_connection",
        new=AsyncMock(return_value=object()),
    ), patch(
        "src.services.meeting_service.MeetingService.update_meeting_status",
        new=AsyncMock(side_effect=fake_update_status),
    ) as update_status:
        await func(job)

    bridge_stop.assert_awaited_once_with("m-1")
    update_status.assert_awaited_once()
    # The bot must be told to leave BEFORE the DB is flipped to completed.
    assert call_order == ["bot_stop", "db_update"]


@pytest.mark.asyncio
async def test_stop_meeting_reraises_and_skips_db_update_when_bot_signal_fails():
    service = _make_service()
    func = _stop_meeting_func(service)
    job = _FakeJob({"meeting_id": "m-2"})

    with patch(
        "src.services.meeting_processor_bridge.meeting_processor_bridge.stop_meeting",
        new=AsyncMock(return_value={"success": False, "message": "bot unreachable"}),
    ), patch(
        "src.api.database.connection.get_db_connection",
        new=AsyncMock(return_value=object()),
    ), patch(
        "src.services.meeting_service.MeetingService.update_meeting_status",
        new=AsyncMock(),
    ) as update_status:
        with pytest.raises(Exception):
            await func(job)

    # Must not falsely report the meeting completed when the bot never
    # confirmed it left the call -- the queue's retry executor should retry.
    update_status.assert_not_awaited()
