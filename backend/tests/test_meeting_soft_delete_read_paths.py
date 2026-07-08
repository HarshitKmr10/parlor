"""Read-path audit for the retention tombstone: every workspace-scoped query
that lists/searches/reports on meetings must exclude soft-deleted
(`deleted_at IS NOT NULL`) rows by default, and `get_scoped_any`/`deleted=true`
paths must be able to see them for restore/recovery-listing purposes.

There's no real Postgres in this unit-test environment, so each fake store
below dispatches on the literal `deleted_at` clause the repo emits (matching
this repo's established FakeStore convention, see
tests/test_compliance_retention_repo.py) and filters an in-memory fixture
dataset accordingly -- this proves both that the right SQL is generated *and*
that it would return the right rows.
"""

from __future__ import annotations

import pytest

from src.api.product.meetings_repo import ProductMeetingsRepo
from src.highlights.repo import HighlightsRepo
from src.reports.repo import ReportsRepo
from src.search.repo import SearchRepo

WORKSPACE_ID = "00000000-0000-0000-0000-000000000042"
LIVE_ID = "10000000-0000-0000-0000-000000000001"
DELETED_ID = "10000000-0000-0000-0000-000000000002"


class _MeetingRow(dict):
    pass


def _rows():
    return [
        _MeetingRow(
            id=LIVE_ID,
            title="live meeting",
            insights=None,
            deleted_at=None,
            status="completed",
            created_at="2026-01-01",
            transcript="pricing discussion",
        ),
        _MeetingRow(
            id=DELETED_ID,
            title="deleted meeting",
            insights=None,
            deleted_at="2026-02-01",
            status="completed",
            created_at="2026-01-02",
            transcript="pricing discussion",
        ),
    ]


class _Db:
    def __init__(self, store) -> None:
        self.store = store


class _MeetingsFakeStore:
    """Backs ProductMeetingsRepo: get_scoped / get_scoped_any / list_ids / count."""

    def __init__(self, rows):
        self.rows = rows

    async def query_raw(self, sql: str, *params):
        matching = [r for r in self.rows if r["id"] == params[0] and WORKSPACE_ID == params[1]] \
            if "id = $1::uuid AND workspace_id = $2::uuid" in sql else None

        if "SELECT id, title, insights FROM" in sql and "deleted_at IS NULL" in sql:
            return [r for r in matching if r["deleted_at"] is None] if matching else []

        if "SELECT id, title, insights, deleted_at FROM" in sql:
            return matching or []

        if sql.strip().startswith("SELECT id FROM"):
            deleted_flag = "deleted_at IS NOT NULL" in sql
            filtered = [
                r
                for r in self.rows
                if (r["deleted_at"] is not None) == deleted_flag
            ]
            return [{"id": r["id"]} for r in filtered]

        if sql.strip().startswith("SELECT COUNT(*) AS n FROM"):
            deleted_flag = "deleted_at IS NOT NULL" in sql
            filtered = [
                r
                for r in self.rows
                if (r["deleted_at"] is not None) == deleted_flag
            ]
            return [{"n": len(filtered)}]

        raise AssertionError(f"unexpected query: {sql}")


@pytest.mark.asyncio
async def test_get_scoped_hides_soft_deleted_meeting():
    repo = ProductMeetingsRepo(_Db(_MeetingsFakeStore(_rows())))

    assert await repo.get_scoped(LIVE_ID, WORKSPACE_ID) is not None
    assert await repo.get_scoped(DELETED_ID, WORKSPACE_ID) is None


@pytest.mark.asyncio
async def test_get_scoped_any_still_sees_soft_deleted_meeting():
    repo = ProductMeetingsRepo(_Db(_MeetingsFakeStore(_rows())))

    assert await repo.get_scoped_any(DELETED_ID, WORKSPACE_ID) is not None


@pytest.mark.asyncio
async def test_list_ids_default_excludes_soft_deleted():
    repo = ProductMeetingsRepo(_Db(_MeetingsFakeStore(_rows())))

    ids = await repo.list_ids(workspace_id=WORKSPACE_ID, statuses=None, limit=50, offset=0)

    assert ids == [LIVE_ID]


@pytest.mark.asyncio
async def test_list_ids_deleted_true_returns_only_soft_deleted():
    repo = ProductMeetingsRepo(_Db(_MeetingsFakeStore(_rows())))

    ids = await repo.list_ids(
        workspace_id=WORKSPACE_ID, statuses=None, limit=50, offset=0, deleted=True
    )

    assert ids == [DELETED_ID]


@pytest.mark.asyncio
async def test_count_default_excludes_soft_deleted():
    repo = ProductMeetingsRepo(_Db(_MeetingsFakeStore(_rows())))

    assert await repo.count(workspace_id=WORKSPACE_ID, statuses=None) == 1


@pytest.mark.asyncio
async def test_count_deleted_true_counts_only_soft_deleted():
    repo = ProductMeetingsRepo(_Db(_MeetingsFakeStore(_rows())))

    assert await repo.count(workspace_id=WORKSPACE_ID, statuses=None, deleted=True) == 1


# ── SearchRepo: cross-meeting keyword search must not surface deleted rows ──


class _SearchFakeStore:
    def __init__(self, rows):
        self.rows = rows

    async def query_raw(self, sql: str, *params):
        assert "deleted_at IS NULL" in sql, f"query missing deleted_at filter: {sql}"
        return [
            {"id": r["id"], "title": r["title"], "transcript": r["transcript"], "insights": None}
            for r in self.rows
            if r["deleted_at"] is None
        ]


@pytest.mark.asyncio
async def test_search_candidates_excludes_soft_deleted_meetings():
    repo = SearchRepo(_Db(_SearchFakeStore(_rows())))

    results = await repo.search_candidates(WORKSPACE_ID, "pricing")

    assert [r["id"] for r in results] == [LIVE_ID]


# ── ReportsRepo: digest must not surface deleted rows ───────────────────────


class _ReportsFakeStore:
    def __init__(self, rows):
        self.rows = rows

    async def query_raw(self, sql: str, *params):
        assert "deleted_at IS NULL" in sql, f"query missing deleted_at filter: {sql}"
        return [
            {
                "id": r["id"],
                "title": r["title"],
                "status": r["status"],
                "created_at": r["created_at"],
                "bot_join_time": None,
                "bot_leave_time": None,
                "duration_sec": None,
            }
            for r in self.rows
            if r["deleted_at"] is None
        ]


@pytest.mark.asyncio
async def test_meetings_in_range_excludes_soft_deleted_meetings():
    repo = ReportsRepo(_Db(_ReportsFakeStore(_rows())))

    rows = await repo.meetings_in_range(WORKSPACE_ID, "2026-01-01", "2026-12-31")

    assert [r["id"] for r in rows] == [LIVE_ID]


# ── GET /api/v1/usage: raw workspace usage query ────────────────────────────


@pytest.mark.asyncio
async def test_usage_query_filters_deleted_at():
    from src.api.product import routes_usage

    class _UsageFakeStore:
        async def query_raw(self, sql: str, *params):
            assert "deleted_at IS NULL" in sql, f"query missing deleted_at filter: {sql}"
            return []

    db = _Db(_UsageFakeStore())

    class _Ctx:
        class workspace:
            id = WORKSPACE_ID

    result = await routes_usage.get_usage(ctx=_Ctx(), db=db)
    assert result.meeting_count == 0


# ── ReportsRepo.action_item_rollup: excludes items from deleted meetings ────


class _ActionItemFakeStore:
    async def query_raw(self, sql: str, *params):
        assert "meeting_joiner" in sql and "deleted_at IS NOT NULL" in sql, (
            f"query missing soft-deleted-meeting exclusion: {sql}"
        )
        return [{"total": 0, "open": 0, "done": 0}] if "total" in sql else []


@pytest.mark.asyncio
async def test_action_item_rollup_excludes_items_from_deleted_meetings():
    repo = ReportsRepo(_Db(_ActionItemFakeStore()))

    rollup = await repo.action_item_rollup(WORKSPACE_ID, "2026-01-01", "2026-12-31")

    assert rollup["total"] == 0


# ── HighlightsRepo: cross-meeting highlights reel excludes deleted meetings ─


class _HighlightsFakeStore:
    async def query_raw(self, sql: str, *params):
        assert "deleted_at IS NULL" in sql, f"query missing deleted_at filter: {sql}"
        return []


@pytest.mark.asyncio
async def test_highlights_list_for_workspace_filters_deleted_meetings():
    repo = HighlightsRepo(_Db(_HighlightsFakeStore()))

    rows = await repo.list_for_workspace(WORKSPACE_ID, limit=20, offset=0)

    assert rows == []


@pytest.mark.asyncio
async def test_highlights_count_for_workspace_filters_deleted_meetings():
    repo = HighlightsRepo(_Db(_HighlightsFakeStore()))

    class _CountStore:
        async def query_raw(self, sql: str, *params):
            assert "deleted_at IS NULL" in sql, f"query missing deleted_at filter: {sql}"
            return [{"n": 0}]

    repo._db.store = _CountStore()
    assert await repo.count_for_workspace(WORKSPACE_ID) == 0
