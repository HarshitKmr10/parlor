"""Tests for the meeting-scheduler poller.

Verifies the due-meeting scan, the atomic single-flight claim (only one
worker dispatches a row across replicas), and that a claimed row flows into
the shared dispatch path. The DatabaseConnection and dispatch_meeting are
mocked — no real DB or warm pool is touched.
"""

from unittest.mock import AsyncMock, patch

import pytest

from src.services.meeting_scheduler import MeetingScheduler

TEAMS_URL = "https://teams.microsoft.com/l/meetup-join/xyz"


class RetryableDispatchError(RuntimeError):
    release_claim_for_retry = True


class TerminalDispatchError(RuntimeError):
    mark_meeting_failed = True


def _due_row(meeting_id="m-1"):
    return {
        "id": meeting_id,
        "meeting_url": TEAMS_URL,
        "bot_name": "Meeting Bot",
        "org_id": None,
        "transcript_source": None,
    }


@pytest.mark.asyncio
async def test_claim_is_single_flight():
    """First claim wins (row returned); a second claim sees no scheduled row."""
    db = AsyncMock()
    # execute_one returns a row the first time (UPDATE matched), None the second
    # (status already flipped away from 'scheduled').
    db.execute_one.side_effect = [{"id": "m-1"}, None]

    scheduler = MeetingScheduler()
    with patch(
        "src.services.meeting_scheduler.get_db_connection",
        new=AsyncMock(return_value=db),
    ):
        first = await scheduler._claim("m-1")
        second = await scheduler._claim("m-1")

    assert first is True
    assert second is False


@pytest.mark.asyncio
async def test_scheduler_uses_configured_schema_for_pg(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("MEETING_JOINER_SCHEMA", "meeting_joiner")
    db = AsyncMock()
    db._driver = "pg"
    db.execute_query.return_value = []
    db.execute_one.return_value = {"id": "m-1"}

    scheduler = MeetingScheduler()
    with patch(
        "src.services.meeting_scheduler.get_db_connection",
        new=AsyncMock(return_value=db),
    ):
        await scheduler._due_meetings()
        due_sql = db.execute_query.await_args.args[0]

        await scheduler._claim("m-1")
        claim_sql = db.execute_one.await_args.args[0]

        await scheduler._release_claim_for_retry("m-1")
        release_sql = db.execute_query.await_args.args[0]

        await scheduler._mark_claim_failed("m-1")
        failed_sql = db.execute_query.await_args.args[0]

    assert 'FROM "meeting_joiner"."meeting_joiner"' in due_sql
    assert 'UPDATE "meeting_joiner"."meeting_joiner"' in claim_sql
    assert 'UPDATE "meeting_joiner"."meeting_joiner"' in release_sql
    assert 'UPDATE "meeting_joiner"."meeting_joiner"' in failed_sql


@pytest.mark.asyncio
async def test_scheduler_keeps_legacy_prisma_table_names(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("MEETING_JOINER_SCHEMA", "meeting_joiner")
    db = AsyncMock()
    db._driver = "prisma"
    db.execute_query.return_value = []
    db.execute_one.return_value = {"id": "m-1"}

    scheduler = MeetingScheduler()
    with patch(
        "src.services.meeting_scheduler.get_db_connection",
        new=AsyncMock(return_value=db),
    ):
        await scheduler._due_meetings()
        due_sql = db.execute_query.await_args.args[0]

        await scheduler._claim("m-1")
        claim_sql = db.execute_one.await_args.args[0]

    assert "FROM meeting_joiner" in due_sql
    assert "UPDATE meeting_joiner" in claim_sql
    assert '"meeting_joiner"."meeting_joiner"' not in due_sql
    assert '"meeting_joiner"."meeting_joiner"' not in claim_sql


@pytest.mark.asyncio
async def test_due_meeting_is_dispatched_after_claim():
    db = AsyncMock()
    db.execute_query.return_value = [_due_row("m-1")]
    db.execute_one.return_value = {"id": "m-1"}  # claim succeeds

    scheduler = MeetingScheduler()
    dispatch = AsyncMock(return_value=(True, "Dispatched to warm-pool pod p-1"))

    with patch(
        "src.services.meeting_scheduler.get_db_connection",
        new=AsyncMock(return_value=db),
    ), patch("src.main.dispatch_meeting", new=dispatch), patch(
        "src.storage.sessions_repo.get_sessions_repo"
    ) as sessions_repo:
        sessions_repo.return_value.open_session = AsyncMock()
        await scheduler._scan_once()

    dispatch.assert_awaited_once()
    kwargs = dispatch.await_args.kwargs
    assert kwargs["meeting_id"] == "m-1"
    assert kwargs["platform"] == "msteams"
    # Session 1 is opened at dispatch time, not at booking time.
    sessions_repo.return_value.open_session.assert_awaited_once()


@pytest.mark.asyncio
async def test_lost_claim_does_not_dispatch():
    """If another replica already claimed the row, we must not dispatch."""
    db = AsyncMock()
    db.execute_query.return_value = [_due_row("m-1")]
    db.execute_one.return_value = None  # claim lost

    scheduler = MeetingScheduler()
    dispatch = AsyncMock()

    with patch(
        "src.services.meeting_scheduler.get_db_connection",
        new=AsyncMock(return_value=db),
    ), patch("src.main.dispatch_meeting", new=dispatch):
        await scheduler._scan_once()

    dispatch.assert_not_awaited()


@pytest.mark.asyncio
async def test_dispatch_failure_restores_scheduled_status_for_retry():
    db = AsyncMock()
    db.execute_one.return_value = {"id": "m-1"}  # claim succeeds

    scheduler = MeetingScheduler()
    dispatch = AsyncMock(side_effect=RetryableDispatchError("sidecar rejected"))

    with patch(
        "src.services.meeting_scheduler.get_db_connection",
        new=AsyncMock(return_value=db),
    ), patch("src.main.dispatch_meeting", new=dispatch), patch(
        "src.storage.sessions_repo.get_sessions_repo"
    ) as sessions_repo:
        sessions_repo.return_value.open_session = AsyncMock()
        with pytest.raises(RuntimeError, match="sidecar rejected"):
            await scheduler._dispatch_due("m-1", _due_row("m-1"))

    dispatch.assert_awaited_once()
    release_query = db.execute_query.await_args.args[0]
    assert "SET status = 'scheduled'" in release_query
    assert db.execute_query.await_args.args[1] == "m-1"


@pytest.mark.asyncio
async def test_ambiguous_dispatch_failure_does_not_restore_scheduled_status():
    db = AsyncMock()
    db.execute_one.return_value = {"id": "m-1"}  # claim succeeds

    scheduler = MeetingScheduler()
    dispatch = AsyncMock(side_effect=RuntimeError("post-configure db failure"))

    with patch(
        "src.services.meeting_scheduler.get_db_connection",
        new=AsyncMock(return_value=db),
    ), patch("src.main.dispatch_meeting", new=dispatch), patch(
        "src.storage.sessions_repo.get_sessions_repo"
    ) as sessions_repo:
        sessions_repo.return_value.open_session = AsyncMock()
        with pytest.raises(RuntimeError, match="post-configure db failure"):
            await scheduler._dispatch_due("m-1", _due_row("m-1"))

    dispatch.assert_awaited_once()
    db.execute_query.assert_not_awaited()


@pytest.mark.asyncio
async def test_terminal_dispatch_failure_marks_claim_failed():
    db = AsyncMock()
    db.execute_one.return_value = {"id": "m-1"}  # claim succeeds

    scheduler = MeetingScheduler()
    dispatch = AsyncMock(side_effect=TerminalDispatchError("secret validation failed"))

    with patch(
        "src.services.meeting_scheduler.get_db_connection",
        new=AsyncMock(return_value=db),
    ), patch("src.main.dispatch_meeting", new=dispatch), patch(
        "src.storage.sessions_repo.get_sessions_repo"
    ) as sessions_repo:
        sessions_repo.return_value.open_session = AsyncMock()
        with pytest.raises(RuntimeError, match="secret validation failed"):
            await scheduler._dispatch_due("m-1", _due_row("m-1"))

    dispatch.assert_awaited_once()
    failed_query = db.execute_query.await_args.args[0]
    assert "SET status = 'failed'" in failed_query
    assert db.execute_query.await_args.args[1] == "m-1"


@pytest.mark.asyncio
async def test_no_due_meetings_is_a_noop():
    db = AsyncMock()
    db.execute_query.return_value = []

    scheduler = MeetingScheduler()
    dispatch = AsyncMock()

    with patch(
        "src.services.meeting_scheduler.get_db_connection",
        new=AsyncMock(return_value=db),
    ), patch("src.main.dispatch_meeting", new=dispatch):
        await scheduler._scan_once()

    dispatch.assert_not_awaited()
    db.execute_one.assert_not_awaited()


@pytest.mark.asyncio
async def test_due_batch_is_dispatched_concurrently():
    """A burst of due meetings all dispatch in one scan (bounded-concurrent).

    The scheduler claims each row atomically, so fanning the batch out under a
    semaphore must still dispatch every meeting exactly once. This is the burst
    path that previously serialized 20 same-time meetings behind one worker.
    """
    rows = [_due_row(f"m-{i}") for i in range(20)]
    db = AsyncMock()
    db.execute_query.return_value = rows
    db.execute_one.return_value = {"id": "claimed"}  # every claim succeeds

    scheduler = MeetingScheduler()
    dispatch = AsyncMock(return_value=(True, "dispatched"))

    with patch(
        "src.services.meeting_scheduler.get_db_connection",
        new=AsyncMock(return_value=db),
    ), patch("src.main.dispatch_meeting", new=dispatch), patch(
        "src.storage.sessions_repo.get_sessions_repo"
    ) as sessions_repo:
        sessions_repo.return_value.open_session = AsyncMock()
        await scheduler._scan_once()

    assert dispatch.await_count == 20
    dispatched_ids = {c.kwargs["meeting_id"] for c in dispatch.await_args_list}
    assert dispatched_ids == {f"m-{i}" for i in range(20)}


@pytest.mark.asyncio
async def test_one_bad_meeting_does_not_sink_the_batch():
    """Per-item error isolation: a single failing dispatch can't abort the rest."""
    rows = [_due_row(f"m-{i}") for i in range(5)]
    db = AsyncMock()
    db.execute_query.return_value = rows
    db.execute_one.return_value = {"id": "claimed"}

    scheduler = MeetingScheduler()

    async def flaky_dispatch(**kwargs):
        if kwargs["meeting_id"] == "m-2":
            raise RuntimeError("boom")
        return (True, "dispatched")

    dispatch = AsyncMock(side_effect=flaky_dispatch)

    with patch(
        "src.services.meeting_scheduler.get_db_connection",
        new=AsyncMock(return_value=db),
    ), patch("src.main.dispatch_meeting", new=dispatch), patch(
        "src.storage.sessions_repo.get_sessions_repo"
    ) as sessions_repo:
        sessions_repo.return_value.open_session = AsyncMock()
        await scheduler._scan_once()  # must not raise

    assert dispatch.await_count == 5
