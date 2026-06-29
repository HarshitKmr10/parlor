"""Unit tests for digest reports: range resolution, aggregation, repo."""

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock

import pytest

from src.reports import ReportsRepo, resolve_range, summarize_meetings
from src.reports.aggregate import InvalidRange

NOW = datetime(2026, 6, 29, 12, 0, tzinfo=timezone.utc)


# ── resolve_range ───────────────────────────────────────────────────────────


def test_default_window_is_trailing_7_days():
    start, end = resolve_range(None, None, now=NOW)
    assert end == NOW
    assert (end - start) == timedelta(days=7)


def test_explicit_iso_range():
    start, end = resolve_range("2026-06-01", "2026-06-08", now=NOW)
    assert start.date().isoformat() == "2026-06-01"
    assert end.date().isoformat() == "2026-06-08"


def test_rejects_inverted_range():
    with pytest.raises(InvalidRange):
        resolve_range("2026-06-08", "2026-06-01", now=NOW)


def test_rejects_window_over_a_year():
    with pytest.raises(InvalidRange):
        resolve_range("2024-01-01", "2026-01-01", now=NOW)


def test_rejects_garbage_dates():
    with pytest.raises(InvalidRange):
        resolve_range("not-a-date", None, now=NOW)


# ── summarize_meetings ──────────────────────────────────────────────────────


def _m(duration=None, status="completed", day=29):
    return {
        "duration_sec": duration,
        "status": status,
        "created_at": datetime(2026, 6, day, 10, 0, tzinfo=timezone.utc),
    }


def test_summarize_counts_and_durations():
    rows = [_m(600), _m(1200), _m(None, status="failed")]
    s = summarize_meetings(rows)
    assert s["meeting_count"] == 3
    assert s["completed_count"] == 2
    assert s["total_duration_sec"] == 1800.0
    assert s["avg_duration_sec"] == 900.0  # averaged over the 2 with duration


def test_summarize_empty():
    s = summarize_meetings([])
    assert s == {
        "meeting_count": 0,
        "completed_count": 0,
        "total_duration_sec": 0.0,
        "avg_duration_sec": 0.0,
        "busiest_day": None,
    }


def test_summarize_busiest_day():
    rows = [_m(60, day=29), _m(60, day=29), _m(60, day=28)]
    assert summarize_meetings(rows)["busiest_day"] == "2026-06-29"


def test_summarize_ignores_negative_duration():
    s = summarize_meetings([_m(-5), _m(100)])
    assert s["total_duration_sec"] == 100.0


# ── repo ────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_meetings_in_range_is_workspace_and_date_scoped():
    db = AsyncMock()
    db.store.query_raw = AsyncMock(return_value=[])
    repo = ReportsRepo(db)
    await repo.meetings_in_range("w1", NOW - timedelta(days=7), NOW)
    sql, *params = db.store.query_raw.await_args.args
    assert "workspace_id = $1::uuid" in sql
    assert "created_at >= $2 AND created_at < $3" in sql
    assert params[0] == "w1"


@pytest.mark.asyncio
async def test_action_item_rollup_shapes_result():
    db = AsyncMock()
    db.store.query_raw = AsyncMock(
        side_effect=[
            [{"total": 5, "open": 3, "done": 2}],
            [{"assignee": "Alice", "open": 2, "done": 1}],
        ]
    )
    repo = ReportsRepo(db)
    out = await repo.action_item_rollup("w1", NOW - timedelta(days=7), NOW)
    assert out["total"] == 5 and out["open"] == 3 and out["done"] == 2
    assert out["by_assignee"][0]["assignee"] == "Alice"


@pytest.mark.asyncio
async def test_action_item_rollup_handles_empty():
    db = AsyncMock()
    db.store.query_raw = AsyncMock(side_effect=[[], []])
    repo = ReportsRepo(db)
    out = await repo.action_item_rollup("w1", NOW - timedelta(days=7), NOW)
    assert out["total"] == 0 and out["by_assignee"] == []
