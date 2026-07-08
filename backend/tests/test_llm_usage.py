"""Tests for per-workspace LLM usage/cost persistence + aggregation.

Purely additive observability (see db/0025_llm_usage_events.sql): this
product has no billing, so these paths must never raise into the caller
(mock mode / ai-service errors return `usage: null`) and must never gate
functionality.
"""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from src.api.product import routes_usage
from src.usage import LlmUsageRepo, capture_llm_usage, usage_record_from_ai_response
from src.usage.llm_repo import LlmUsageRecord

WORKSPACE_ID = "00000000-0000-0000-0000-000000000042"
MEETING_ID = "10000000-0000-0000-0000-000000000001"


def _usage_payload(**overrides):
    payload = {
        "promptTokens": 120,
        "completionTokens": 45,
        "totalTokens": 165,
        "provider": "anthropic",
        "model": "claude-sonnet",
        "estimatedCostUsd": 0.0123,
    }
    payload.update(overrides)
    return payload


# ── usage_record_from_ai_response ───────────────────────────────────────────


def test_usage_record_built_when_usage_present():
    data = {"summary": "hi", "usage": _usage_payload()}
    record = usage_record_from_ai_response(
        workspace_id=WORKSPACE_ID,
        meeting_id=MEETING_ID,
        operation="summarize",
        data=data,
    )
    assert record is not None
    assert record.workspace_id == WORKSPACE_ID
    assert record.meeting_id == MEETING_ID
    assert record.operation == "summarize"
    assert record.provider == "anthropic"
    assert record.model == "claude-sonnet"
    assert record.prompt_tokens == 120
    assert record.completion_tokens == 45
    assert record.total_tokens == 165
    assert record.estimated_cost_usd == 0.0123


def test_usage_record_none_when_usage_null():
    """Mock mode / a completed-but-uncosted call returns usage: null."""
    data = {"summary": "hi", "usage": None}
    assert (
        usage_record_from_ai_response(
            workspace_id=WORKSPACE_ID, meeting_id=None, operation="summarize", data=data
        )
        is None
    )


def test_usage_record_none_when_data_missing():
    assert (
        usage_record_from_ai_response(
            workspace_id=WORKSPACE_ID, meeting_id=None, operation="chat", data=None
        )
        is None
    )
    assert (
        usage_record_from_ai_response(
            workspace_id=WORKSPACE_ID, meeting_id=None, operation="chat", data={}
        )
        is None
    )


def test_usage_record_tolerates_null_estimated_cost():
    """A model with no pricing entry reports estimatedCostUsd: null."""
    data = {"usage": _usage_payload(estimatedCostUsd=None)}
    record = usage_record_from_ai_response(
        workspace_id=WORKSPACE_ID, meeting_id=None, operation="embed", data=data
    )
    assert record is not None
    assert record.estimated_cost_usd is None


def test_usage_record_none_on_malformed_usage():
    """A malformed usage blob must never raise -- observability is best-effort."""
    data = {"usage": {"promptTokens": "not-a-number"}}
    assert (
        usage_record_from_ai_response(
            workspace_id=WORKSPACE_ID, meeting_id=None, operation="chat", data=data
        )
        is None
    )


# ── capture_llm_usage (best-effort persistence) ─────────────────────────────


@pytest.mark.asyncio
async def test_capture_llm_usage_persists_when_present():
    db = AsyncMock()
    db.store.query_raw = AsyncMock(return_value=[])

    await capture_llm_usage(
        db,
        workspace_id=WORKSPACE_ID,
        meeting_id=MEETING_ID,
        operation="chat",
        data={"answer": "hi", "usage": _usage_payload()},
    )

    db.store.query_raw.assert_awaited_once()
    sql, params = db.store.query_raw.call_args[0][0], db.store.query_raw.call_args[0][1:]
    assert "INSERT INTO llm_usage_events" in sql
    assert params[0] == WORKSPACE_ID
    assert params[1] == MEETING_ID
    assert params[2] == "chat"


@pytest.mark.asyncio
async def test_capture_llm_usage_noop_when_usage_null():
    db = AsyncMock()
    db.store.query_raw = AsyncMock(return_value=[])

    await capture_llm_usage(
        db,
        workspace_id=WORKSPACE_ID,
        meeting_id=None,
        operation="summarize",
        data={"summary": "hi", "usage": None},
    )

    db.store.query_raw.assert_not_awaited()


@pytest.mark.asyncio
async def test_capture_llm_usage_never_raises_when_db_fails():
    db = AsyncMock()
    db.store.query_raw = AsyncMock(side_effect=RuntimeError("db down"))

    # Must not raise even though the underlying insert fails.
    await capture_llm_usage(
        db,
        workspace_id=WORKSPACE_ID,
        meeting_id=None,
        operation="embed",
        data={"embedded": 3, "usage": _usage_payload()},
    )


@pytest.mark.asyncio
async def test_capture_llm_usage_never_raises_on_garbage_db():
    """Callers that don't wire a real db (e.g. calling a route fn directly in
    a unit test without FastAPI DI) must not blow up the calling flow."""
    await capture_llm_usage(
        object(),
        workspace_id=WORKSPACE_ID,
        meeting_id=None,
        operation="chat",
        data={"usage": _usage_payload()},
    )


# ── LlmUsageRepo aggregation SQL ─────────────────────────────────────────────


class _FakeStore:
    def __init__(self, totals_row, breakdown_rows, daily_rows) -> None:
        self._totals_row = totals_row
        self._breakdown_rows = breakdown_rows
        self._daily_rows = daily_rows
        self.calls: list[str] = []

    async def query_raw(self, sql: str, *params):
        self.calls.append(sql)
        if "GROUP BY provider, model" in sql:
            return self._breakdown_rows
        if "date_trunc" in sql:
            return self._daily_rows
        return [self._totals_row]


class _Db:
    def __init__(self, store) -> None:
        self.store = store


@pytest.mark.asyncio
async def test_get_totals_aggregates_across_calls():
    store = _FakeStore(
        totals_row={"total_tokens": 500, "estimated_cost_usd": 0.5, "call_count": 3},
        breakdown_rows=[],
        daily_rows=[],
    )
    repo = LlmUsageRepo(_Db(store))
    totals = await repo.get_totals(WORKSPACE_ID)
    assert totals == {"total_tokens": 500, "estimated_cost_usd": 0.5, "call_count": 3}
    assert "workspace_id = $1::uuid" in store.calls[0]


@pytest.mark.asyncio
async def test_get_breakdown_groups_by_provider_and_model():
    store = _FakeStore(
        totals_row={},
        breakdown_rows=[
            {
                "provider": "anthropic",
                "model": "claude-sonnet",
                "total_tokens": 300,
                "estimated_cost_usd": 0.3,
                "call_count": 2,
            },
            {
                "provider": "openai",
                "model": "gpt-4o",
                "total_tokens": 200,
                "estimated_cost_usd": 0.2,
                "call_count": 1,
            },
        ],
        daily_rows=[],
    )
    repo = LlmUsageRepo(_Db(store))
    breakdown = await repo.get_breakdown_by_provider_model(WORKSPACE_ID)
    assert breakdown[0]["provider"] == "anthropic"
    assert breakdown[0]["total_tokens"] == 300
    assert breakdown[1]["provider"] == "openai"


@pytest.mark.asyncio
async def test_record_inserts_expected_columns():
    store = _FakeStore(totals_row={}, breakdown_rows=[], daily_rows=[])
    repo = LlmUsageRepo(_Db(store))
    await repo.record(
        LlmUsageRecord(
            workspace_id=WORKSPACE_ID,
            meeting_id=MEETING_ID,
            operation="summarize",
            provider="anthropic",
            model="claude-sonnet",
            prompt_tokens=10,
            completion_tokens=5,
            total_tokens=15,
            estimated_cost_usd=0.01,
        )
    )
    assert "INSERT INTO llm_usage_events" in store.calls[0]


# ── GET /api/v1/usage aggregation across providers/models ──────────────────


class _UsageFakeStore:
    """Returns canned meeting rows + llm aggregate rows keyed off the SQL
    shape, matching this repo's established FakeStore convention (see
    tests/test_meeting_soft_delete_read_paths.py)."""

    async def query_raw(self, sql: str, *params):
        if "meeting_joiner" in sql:
            return [
                {"id": "m-1", "status": "completed", "duration_sec": 600},
                {"id": "m-2", "status": "completed", "duration_sec": 1200},
            ]
        if "GROUP BY provider, model" in sql:
            return [
                {
                    "provider": "anthropic",
                    "model": "claude-sonnet",
                    "total_tokens": 300,
                    "estimated_cost_usd": 0.3,
                    "call_count": 2,
                },
                {
                    "provider": "openai",
                    "model": "gpt-4o",
                    "total_tokens": 200,
                    "estimated_cost_usd": 0.2,
                    "call_count": 1,
                },
            ]
        if "date_trunc" in sql:
            return []
        # totals query
        return [{"total_tokens": 500, "estimated_cost_usd": 0.5, "call_count": 3}]


class _Ctx:
    class workspace:
        id = WORKSPACE_ID


@pytest.mark.asyncio
async def test_get_usage_aggregates_llm_tokens_and_cost():
    db = _Db(_UsageFakeStore())
    result = await routes_usage.get_usage(ctx=_Ctx(), db=db)

    assert result.meeting_count == 2
    assert result.llm_total_tokens == 500
    assert result.llm_estimated_cost_usd == 0.5
    assert result.llm_call_count == 3
    assert len(result.llm_breakdown) == 2
    assert result.llm_breakdown[0].provider == "anthropic"
    assert result.llm_breakdown[0].total_tokens == 300
    assert result.llm_breakdown[1].provider == "openai"
    assert result.llm_daily_trend == []
