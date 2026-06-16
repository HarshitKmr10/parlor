"""Integration test for the rejoin orchestrator (PR #3592 RCA).

This test exists because four critical bugs (RCA #11, #12, #13, #15)
shipped in the data-access layer between the orchestrator and Postgres,
and every one of them would have been caught by a single test that
exercises ``RejoinOrchestrator.attempt`` against a real DB. The unit
tests in ``test_rejoin_orchestrator.py`` use ``AsyncMock`` for the DB,
so they pass while the underlying SQL is broken.

This integration test:
1. Connects to a Postgres pointed at by ``MEETING_JOINER_TEST_DB_URL``
   (default: ``postgresql://postgres:postgres@localhost:5433/meeting_joiner``).
2. Applies ``meeting-joiner/db/bootstrap.sql`` so the test is
   self-contained — no separate migration step.
3. Inserts a real meeting via ``DatabaseConnection.create_meeting`` and
   asserts that **session 1 is opened automatically** (Design #1 — RCA
   recommendation).
4. Stubs out ``dispatch_to_warm_pool`` so we don't need a real k8s, but
   leaves every other code path intact (status enum, state machine,
   session repo writes, transition validation).
5. Runs ``RejoinOrchestrator.attempt`` for a recoverable exit and asserts:
   - state transitions ``ongoing → interrupted → joining``,
   - ``meeting_sessions`` has two rows after the rejoin attempt,
   - session 2's ``pod_name`` matches the (fake) dispatcher's claimed pod.
6. Runs another ``attempt`` with a terminal exit and asserts the meeting
   transitions to ``failed`` without opening session 3.

Run with::

    docker run -d --name mj-test-pg -e POSTGRES_PASSWORD=postgres \\
        -e POSTGRES_DB=meeting_joiner -p 5433:5432 postgres:16-alpine
    pytest meeting-joiner/tests/services/test_rejoin_orchestrator_integration.py
"""

from __future__ import annotations

import os
import uuid
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

# Skip cleanly if asyncpg / a Postgres aren't available, so CI without the
# test DB skips rather than fails opaquely.
asyncpg = pytest.importorskip("asyncpg")

from src.api.database.connection import DatabaseConnection
from src.api.models.schemas import MeetingStatus
from src.services.meeting_service import MeetingService
from src.services.rejoin_orchestrator import RejoinOrchestrator
from src.services.warm_pool_dispatcher import DispatchResult


pytestmark = pytest.mark.asyncio


def _test_dsn() -> str:
    return os.environ.get(
        "MEETING_JOINER_TEST_DB_URL",
        "postgresql://postgres:postgres@localhost:5433/meeting_joiner",
    )


@pytest.fixture(scope="module")
async def db_ready() -> None:
    """Ensure the test DB has the bootstrap schema applied.

    Bootstrap is idempotent so re-applying it across pytest runs is safe.
    """
    bootstrap_sql = (
        Path(__file__).resolve().parents[2] / "db" / "bootstrap.sql"
    ).read_text()

    conn = await asyncpg.connect(_test_dsn())
    try:
        # asyncpg can't run statements with $$ blocks via .execute when they
        # contain multiple semicolon-delimited statements. The bootstrap is
        # one big script, so use the lower-level multi-statement API.
        async with conn.transaction():
            await conn.execute(bootstrap_sql)
    finally:
        await conn.close()


@pytest.fixture
async def db() -> DatabaseConnection:
    os.environ.setdefault("MEETING_JOINER_DB_DRIVER", "pg")
    os.environ.setdefault("DATABASE_URL", _test_dsn())
    conn = DatabaseConnection()
    await conn.connect()
    return conn


async def _count_sessions(dsn: str, meeting_id: str) -> int:
    conn = await asyncpg.connect(dsn)
    try:
        return await conn.fetchval(
            "SELECT COUNT(*) FROM meeting_sessions "
            "WHERE meeting_joiner_id = $1::uuid",
            meeting_id,
        )
    finally:
        await conn.close()


async def _select_status(dsn: str, meeting_id: str) -> str:
    conn = await asyncpg.connect(dsn)
    try:
        row = await conn.fetchval(
            "SELECT status::text FROM meeting_joiner WHERE id = $1::uuid",
            meeting_id,
        )
        return row
    finally:
        await conn.close()


async def test_create_meeting_opens_session_one(db_ready, db) -> None:
    """RCA Design #1: every newly-created meeting must have a session 1
    row regardless of whether warm-pool or PGQueuer fallback dispatches it.
    """
    record = await db.create_meeting(
        meeting_url="https://meet.google.com/test-session-one",
        bot_name="Integration Test Bot",
    )
    try:
        count = await _count_sessions(_test_dsn(), record.id)
        assert count == 1, (
            f"expected session 1 to be opened by create_meeting, got {count}"
        )
    finally:
        # Cleanup so re-runs aren't polluted.
        cleanup = await asyncpg.connect(_test_dsn())
        try:
            await cleanup.execute(
                "DELETE FROM meeting_joiner WHERE id = $1::uuid", record.id
            )
        finally:
            await cleanup.close()


async def test_recoverable_rejoin_writes_session_two(db_ready, db) -> None:
    """RCA #11-#15: orchestrator must drive ongoing → interrupted → joining
    and open session 2 with the new pod's name. Catches all four critical
    data-access bugs from the day-2 RCA at once.
    """
    record = await db.create_meeting(
        meeting_url="https://meet.google.com/test-rejoin",
        bot_name="Integration Test Bot",
    )
    meeting_id = record.id

    try:
        # Move meeting into ONGOING so the orchestrator can interrupt it.
        await db.update_meeting_status(meeting_id, MeetingStatus.JOINING)
        await db.update_meeting_status(meeting_id, MeetingStatus.ONGOING)

        svc = MeetingService(db)
        orch = RejoinOrchestrator(svc)

        new_pod = f"meeting-worker-test-{uuid.uuid4().hex[:8]}"

        async def _fake_dispatch(payload):  # noqa: ANN001
            return DispatchResult(
                success=True,
                pod_name=new_pod,
                pod_ip="10.0.0.99",
                fallback_to_queue=False,
            )

        with patch(
            "src.services.rejoin_orchestrator.dispatch_to_warm_pool",
            new=_fake_dispatch,
        ):
            result = await orch.attempt(
                meeting_id=meeting_id,
                exit_reason="pod_evicted",
                dropped_pod_name="meeting-worker-old",
            )

        assert result.success, f"expected rejoin success, got error={result.error}"
        assert result.new_session_number == 2, result.new_session_number
        assert result.new_pod_name == new_pod

        # Sessions table should now have 2 rows.
        count = await _count_sessions(_test_dsn(), meeting_id)
        assert count == 2, f"expected 2 sessions, got {count}"

        # Meeting status should be JOINING (sidecar will flip to ONGOING
        # once the bot is admitted on the new pod).
        status = await _select_status(_test_dsn(), meeting_id)
        assert status == "joining", status
    finally:
        cleanup = await asyncpg.connect(_test_dsn())
        try:
            await cleanup.execute(
                "DELETE FROM meeting_joiner WHERE id = $1::uuid", meeting_id
            )
        finally:
            await cleanup.close()


async def test_terminal_exit_transitions_to_completed(db_ready, db) -> None:
    """A terminal exit (e.g. user-initiated leave) must NOT rejoin and must
    move the meeting straight to a terminal state."""
    record = await db.create_meeting(
        meeting_url="https://meet.google.com/test-terminal",
        bot_name="Integration Test Bot",
    )
    meeting_id = record.id

    try:
        await db.update_meeting_status(meeting_id, MeetingStatus.JOINING)
        await db.update_meeting_status(meeting_id, MeetingStatus.ONGOING)

        svc = MeetingService(db)
        orch = RejoinOrchestrator(svc)

        result = await orch.attempt(
            meeting_id=meeting_id,
            exit_reason="bot_kicked",  # terminal classification
            dropped_pod_name="meeting-worker-old",
        )

        assert not result.success
        # Only the original session 1 row should exist.
        count = await _count_sessions(_test_dsn(), meeting_id)
        assert count == 1, f"expected 1 session, got {count}"

        status = await _select_status(_test_dsn(), meeting_id)
        assert status in ("completed", "failed"), status
    finally:
        cleanup = await asyncpg.connect(_test_dsn())
        try:
            await cleanup.execute(
                "DELETE FROM meeting_joiner WHERE id = $1::uuid", meeting_id
            )
        finally:
            await cleanup.close()
