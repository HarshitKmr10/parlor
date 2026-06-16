"""Unit tests for the sessions repository.

DB interactions are mocked; full SQL exercise is in the integration suite
(``tests/integration/test_pod_death_recovery.py`` — Phase 3 integration).
"""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest

from src.storage.sessions_repo import (
    SessionsRepository,
    _row_to_session,
    get_sessions_repo,
)


def _row(
    session_number: int = 1,
    pod_name: str | None = "pod-1",
    ended_at: datetime | None = None,
) -> dict:
    now = datetime.now(timezone.utc)
    return {
        "id": "00000000-0000-0000-0000-000000000001",
        "meeting_joiner_id": "00000000-0000-0000-0000-000000000010",
        "session_number": session_number,
        "pod_name": pod_name,
        "cluster_name": "cluster-x",
        "started_at": now,
        "ended_at": ended_at,
        "admitted_at": now,
        "exit_reason": None,
        "exit_classification": None,
        "last_segment_ts": None,
    }


def _mock_db_with_response(
    execute_one_return=None, execute_query_return=None, driver="prisma"
):
    db = AsyncMock()
    db._driver = driver
    db._connected = True
    db.execute_one = AsyncMock(return_value=execute_one_return)
    db.execute_query = AsyncMock(return_value=execute_query_return or [])
    db.execute = AsyncMock()
    return db


@pytest.mark.asyncio
@pytest.mark.unit
async def test_open_session_increments_session_number() -> None:
    db = _mock_db_with_response(execute_one_return=_row(session_number=3))
    repo = SessionsRepository()

    with patch(
        "src.storage.sessions_repo.get_db_connection",
        new=AsyncMock(return_value=db),
    ):
        session = await repo.open_session(meeting_joiner_id="m-1", pod_name="pod-3")

    assert session.session_number == 3
    assert session.pod_name == "pod-1"  # from row mock; column is pod_name


@pytest.mark.asyncio
@pytest.mark.unit
async def test_sessions_repo_uses_configured_schema(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("MEETING_JOINER_SCHEMA", "meeting_joiner")
    db = _mock_db_with_response(
        execute_one_return=_row(session_number=1),
        execute_query_return=[_row(session_number=1)],
        driver="pg",
    )
    repo = SessionsRepository()

    with patch(
        "src.storage.sessions_repo.get_db_connection",
        new=AsyncMock(return_value=db),
    ):
        await repo.open_session(meeting_joiner_id="m-1", pod_name="pod-1")
        await repo.mark_admitted("session-1")
        await repo.update_pod_name_for_session(
            meeting_joiner_id="m-1",
            session_number=1,
            pod_name="pod-1",
        )
        await repo.update_last_segment("session-1", datetime.now(timezone.utc))
        await repo.close_session(
            "session-1",
            exit_reason="trackGone",
            exit_classification="recoverable",
        )
        await repo.get_latest_session("m-1")
        await repo.list_sessions("m-1")

    queries = [
        *(call.args[0] for call in db.execute_one.await_args_list),
        *(call.args[0] for call in db.execute.await_args_list),
        *(call.args[0] for call in db.execute_query.await_args_list),
    ]
    assert queries
    assert all('"meeting_joiner"."meeting_sessions"' in sql for sql in queries)


@pytest.mark.asyncio
@pytest.mark.unit
async def test_sessions_repo_keeps_legacy_prisma_table_name(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("MEETING_JOINER_SCHEMA", "meeting_joiner")
    db = _mock_db_with_response(
        execute_one_return=_row(session_number=1),
        execute_query_return=[_row(session_number=1)],
        driver="prisma",
    )
    repo = SessionsRepository()

    with patch(
        "src.storage.sessions_repo.get_db_connection",
        new=AsyncMock(return_value=db),
    ):
        await repo.open_session(meeting_joiner_id="m-1", pod_name="pod-1")
        await repo.mark_admitted("session-1")
        await repo.update_pod_name_for_session(
            meeting_joiner_id="m-1",
            session_number=1,
            pod_name="pod-1",
        )
        await repo.update_last_segment("session-1", datetime.now(timezone.utc))
        await repo.close_session(
            "session-1",
            exit_reason="trackGone",
            exit_classification="recoverable",
        )
        await repo.get_latest_session("m-1")
        await repo.list_sessions("m-1")

    queries = [
        *(call.args[0] for call in db.execute_one.await_args_list),
        *(call.args[0] for call in db.execute.await_args_list),
        *(call.args[0] for call in db.execute_query.await_args_list),
    ]
    assert queries
    assert all("meeting_sessions" in sql for sql in queries)
    assert all('"meeting_joiner"."meeting_sessions"' not in sql for sql in queries)


@pytest.mark.asyncio
@pytest.mark.unit
async def test_count_sessions_uses_configured_schema(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("MEETING_JOINER_SCHEMA", "meeting_joiner")
    db = _mock_db_with_response(execute_one_return={"c": 2}, driver="pg")
    repo = SessionsRepository()

    with patch(
        "src.storage.sessions_repo.get_db_connection",
        new=AsyncMock(return_value=db),
    ):
        assert await repo.count_sessions("m-1") == 2

    sql = db.execute_one.await_args.args[0]
    assert 'FROM "meeting_joiner"."meeting_sessions"' in sql


@pytest.mark.asyncio
@pytest.mark.unit
async def test_open_session_raises_when_db_returns_none() -> None:
    db = _mock_db_with_response(execute_one_return=None)
    repo = SessionsRepository()

    with patch(
        "src.storage.sessions_repo.get_db_connection",
        new=AsyncMock(return_value=db),
    ):
        with pytest.raises(RuntimeError):
            await repo.open_session(meeting_joiner_id="m-1", pod_name="pod-1")


@pytest.mark.asyncio
@pytest.mark.unit
async def test_close_session_passes_classification() -> None:
    db = _mock_db_with_response()
    repo = SessionsRepository()

    with patch(
        "src.storage.sessions_repo.get_db_connection",
        new=AsyncMock(return_value=db),
    ):
        await repo.close_session(
            "session-1",
            exit_reason="trackGone",
            exit_classification="recoverable",
        )

    assert db.execute.await_count == 1
    args = db.execute.await_args.args
    assert "ended_at" in args[0]
    assert "trackGone" in args
    assert "recoverable" in args


@pytest.mark.asyncio
@pytest.mark.unit
async def test_count_sessions_returns_zero_on_empty() -> None:
    db = _mock_db_with_response(execute_one_return=None)
    repo = SessionsRepository()

    with patch(
        "src.storage.sessions_repo.get_db_connection",
        new=AsyncMock(return_value=db),
    ):
        count = await repo.count_sessions("m-doesnt-exist")

    assert count == 0


@pytest.mark.asyncio
@pytest.mark.unit
async def test_list_sessions_orders_by_session_number_asc() -> None:
    rows = [_row(session_number=1), _row(session_number=2), _row(session_number=3)]
    db = _mock_db_with_response(execute_query_return=rows)
    repo = SessionsRepository()

    with patch(
        "src.storage.sessions_repo.get_db_connection",
        new=AsyncMock(return_value=db),
    ):
        sessions = await repo.list_sessions("m-1")

    assert [s.session_number for s in sessions] == [1, 2, 3]


@pytest.mark.unit
def test_get_sessions_repo_is_singleton() -> None:
    a = get_sessions_repo()
    b = get_sessions_repo()
    assert a is b


@pytest.mark.unit
def test_row_to_session_handles_nulls() -> None:
    row = _row()
    row["pod_name"] = None
    row["last_segment_ts"] = None

    session = _row_to_session(row)

    assert session.pod_name is None
    assert session.last_segment_ts is None
    assert session.session_number == 1
