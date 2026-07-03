"""Regression tests for #60: the product API's finalize endpoints
(`POST /{meeting_id}/complete` and `DELETE /{meeting_id}` in
`src/api/product/routes_meetings.py`) used check-then-act — read the status,
then unconditionally write `COMPLETED` and fire the completion pipeline.
Two concurrent finalize requests can both observe a non-terminal status
between the read and the write, so both fire the embed->summarize->recap
pipeline, duplicating webhooks/recaps.

These tests assert both handlers now route through the guarded
`MeetingService.complete_if_active` (a conditional UPDATE, mirroring
`ConsolidationCursorRepo.claim`/`claim_for_rejoin`) and only fire the
pipeline when that guard actually won the race (returned `True`).
"""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest

from src.api.models.schemas import MeetingRecord, MeetingStatus
from src.api.product import routes_meetings
from src.api.product.schemas import Workspace

UTC = timezone.utc


def _workspace() -> Workspace:
    return Workspace(id="ws-1", name="Acme", slug="acme", role="owner")


def _record(*, status: MeetingStatus) -> MeetingRecord:
    base = datetime(2026, 6, 5, 10, 0, 0, tzinfo=UTC)
    return MeetingRecord(
        id="m-1",
        meeting_url="https://teams.microsoft.com/meet/m-1",
        status=status,
        platform="msteams",
        org_id=None,
        bot_name="Meeting Bot",
        is_duplicate=False,
        original_meeting_id=None,
        created_at=base,
        updated_at=base,
    )


def _service_and_repo(record: MeetingRecord):
    service = AsyncMock()
    service.get_meeting_by_id.return_value = record
    repo = AsyncMock()
    repo.get_scoped.return_value = {"id": "m-1", "title": "Standup"}
    return service, repo


class TestCompleteMeetingUsesGuardedWrite:
    @pytest.mark.asyncio
    async def test_ongoing_meeting_calls_guarded_write_not_unconditional_status_update(self):
        service, repo = _service_and_repo(_record(status=MeetingStatus.ONGOING))
        service.complete_if_active.return_value = True

        with patch.object(routes_meetings, "_fire_completion_pipeline") as fire:
            await routes_meetings.complete_meeting("m-1", _workspace(), service, repo)

        service.complete_if_active.assert_awaited_once_with("m-1")
        service.update_meeting_status.assert_not_awaited()
        fire.assert_called_once_with("m-1")

    @pytest.mark.asyncio
    async def test_lost_race_skips_firing_the_completion_pipeline(self):
        """The exact scenario in #60: a concurrent finalize request already
        won the guarded write between this request's read and its own write
        attempt. `complete_if_active` returns False for the loser, and the
        loser must NOT fire a second completion pipeline."""
        service, repo = _service_and_repo(_record(status=MeetingStatus.ONGOING))
        service.complete_if_active.return_value = False

        with patch.object(routes_meetings, "_fire_completion_pipeline") as fire:
            await routes_meetings.complete_meeting("m-1", _workspace(), service, repo)

        service.complete_if_active.assert_awaited_once_with("m-1")
        fire.assert_not_called()

    @pytest.mark.asyncio
    async def test_two_concurrent_completes_fire_the_pipeline_at_most_once(self):
        """Simulates the double-fire race directly: two requests both read
        the meeting as `ongoing`, then both call the route handler. Only the
        winner of the guarded write may fire the pipeline."""
        record = _record(status=MeetingStatus.ONGOING)
        service, repo = _service_and_repo(record)
        # First caller's write wins the CAS race, second caller's loses.
        service.complete_if_active.side_effect = [True, False]

        with patch.object(routes_meetings, "_fire_completion_pipeline") as fire:
            await routes_meetings.complete_meeting("m-1", _workspace(), service, repo)
            await routes_meetings.complete_meeting("m-1", _workspace(), service, repo)

        assert fire.call_count == 1
        assert service.complete_if_active.await_count == 2

    @pytest.mark.asyncio
    async def test_already_terminal_meeting_is_a_no_op(self):
        """Regression: idempotent no-op path must remain unchanged."""
        service, repo = _service_and_repo(_record(status=MeetingStatus.COMPLETED))

        with patch.object(routes_meetings, "_fire_completion_pipeline") as fire:
            await routes_meetings.complete_meeting("m-1", _workspace(), service, repo)

        service.complete_if_active.assert_not_awaited()
        service.update_meeting_status.assert_not_awaited()
        fire.assert_not_called()


class TestStopMeetingUsesGuardedWrite:
    @pytest.mark.asyncio
    async def test_ongoing_meeting_calls_guarded_write_not_unconditional_status_update(self):
        service, repo = _service_and_repo(_record(status=MeetingStatus.ONGOING))
        service.complete_if_active.return_value = True

        with patch.object(routes_meetings, "_fire_completion_pipeline") as fire:
            await routes_meetings.stop_meeting("m-1", _workspace(), service, repo)

        service.complete_if_active.assert_awaited_once_with("m-1")
        service.update_meeting_status.assert_not_awaited()
        fire.assert_called_once_with("m-1")

    @pytest.mark.asyncio
    async def test_lost_race_skips_firing_the_completion_pipeline(self):
        service, repo = _service_and_repo(_record(status=MeetingStatus.ONGOING))
        service.complete_if_active.return_value = False

        with patch.object(routes_meetings, "_fire_completion_pipeline") as fire:
            await routes_meetings.stop_meeting("m-1", _workspace(), service, repo)

        service.complete_if_active.assert_awaited_once_with("m-1")
        fire.assert_not_called()

    @pytest.mark.asyncio
    async def test_concurrent_complete_and_stop_fire_the_pipeline_at_most_once(self):
        """Cross-endpoint race: a botless client calling POST /complete and a
        user clicking "stop" (DELETE) at the same time must still only fire
        the pipeline once."""
        record = _record(status=MeetingStatus.ONGOING)
        service, repo = _service_and_repo(record)
        service.complete_if_active.side_effect = [True, False]

        with patch.object(routes_meetings, "_fire_completion_pipeline") as fire:
            await routes_meetings.complete_meeting("m-1", _workspace(), service, repo)
            await routes_meetings.stop_meeting("m-1", _workspace(), service, repo)

        assert fire.call_count == 1

    @pytest.mark.asyncio
    async def test_already_terminal_meeting_is_a_no_op(self):
        service, repo = _service_and_repo(_record(status=MeetingStatus.FAILED))

        with patch.object(routes_meetings, "_fire_completion_pipeline") as fire:
            await routes_meetings.stop_meeting("m-1", _workspace(), service, repo)

        service.complete_if_active.assert_not_awaited()
        service.update_meeting_status.assert_not_awaited()
        fire.assert_not_called()
