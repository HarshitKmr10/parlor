"""Unit tests for action items: dedupe normalization + repo behavior."""

from dataclasses import dataclass
from unittest.mock import AsyncMock, patch

import pytest

from src.action_items import ActionItemsRepo, dedupe_ai_items, dedupe_key

# ── dedupe ──────────────────────────────────────────────────────────────────


def test_dedupe_key_normalizes_case_and_whitespace():
    assert dedupe_key("Email   the   Client") == dedupe_key("email the client")
    assert dedupe_key("  Ship it ") == dedupe_key("ship it")


def test_dedupe_key_differs_for_different_text():
    assert dedupe_key("a") != dedupe_key("b")


def test_dedupe_key_works_under_fips_mode_usedforsecurity_false():
    """Regression: bare hashlib.md5(...) raises ValueError under FIPS-mode
    OpenSSL builds. usedforsecurity=False documents this is a non-crypto
    dedup fingerprint (not used for security) and avoids the crash."""
    import hashlib

    with patch.object(
        hashlib,
        "md5",
        wraps=hashlib.md5,
    ) as md5_spy:
        dedupe_key("Ship it")

    _, kwargs = md5_spy.call_args
    assert kwargs.get("usedforsecurity") is False


@dataclass
class AI:
    text: str
    assignee: str = None
    due_date: str = None


def test_dedupe_ai_items_drops_blanks_and_dupes():
    items = dedupe_ai_items(
        [AI("Do X"), AI("  "), AI("do x"), AI("Do Y", assignee="Bob")]
    )
    texts = [i["text"] for i in items]
    assert texts == ["Do X", "Do Y"]  # "do x" deduped, blank dropped
    assert items[1]["assignee"] == "Bob"
    assert all("dedupe_key" in i for i in items)


def test_dedupe_ai_items_accepts_dicts():
    items = dedupe_ai_items([{"text": "Call Sam", "dueDate": "Friday"}])
    assert items[0]["text"] == "Call Sam"
    assert items[0]["due_date"] == "Friday"  # camel dueDate picked up


def test_dedupe_ai_items_empty():
    assert dedupe_ai_items([]) == []
    assert dedupe_ai_items(None) == []


# ── repo ────────────────────────────────────────────────────────────────────


def _row(**over):
    base = {
        "id": "a1",
        "workspace_id": "w1",
        "meeting_id": "m1",
        "created_by": None,
        "text": "Do X",
        "assignee": None,
        "due_date": None,
        "done": False,
        "source": "manual",
        "created_at": None,
        "updated_at": None,
    }
    base.update(over)
    return base


@pytest.mark.asyncio
async def test_create_sets_dedupe_key_and_source():
    db = AsyncMock()
    db.store.query_raw = AsyncMock(return_value=[_row()])
    repo = ActionItemsRepo(db)
    await repo.create(
        workspace_id="w1",
        meeting_id="m1",
        created_by=None,
        text="Do X",
        assignee=None,
        due_date=None,
    )
    _, *params = db.store.query_raw.await_args.args
    assert params[4] == dedupe_key("Do X")  # dedupe_key computed
    assert params[7] == "manual"


@pytest.mark.asyncio
async def test_sync_ai_items_counts_inserts():
    db = AsyncMock()
    # First insert returns a row (new), second returns [] (conflict, skipped).
    db.store.query_raw = AsyncMock(side_effect=[[{"id": "x"}], []])
    repo = ActionItemsRepo(db)
    n = await repo.sync_ai_items(
        workspace_id="w1",
        meeting_id="m1",
        items=[
            {"text": "A", "dedupe_key": "k1"},
            {"text": "B", "dedupe_key": "k2"},
        ],
    )
    assert n == 1
    # upsert uses ON CONFLICT DO NOTHING scoped to ai source
    sql = db.store.query_raw.await_args_list[0].args[0]
    assert "ON CONFLICT" in sql and "source = 'ai'" in sql


@pytest.mark.asyncio
async def test_list_for_workspace_filters_are_null_safe():
    db = AsyncMock()
    db.store.query_raw = AsyncMock(return_value=[])
    repo = ActionItemsRepo(db)
    await repo.list_for_workspace("w1", assignee=None, done=None, limit=10, offset=0)
    sql, *params = db.store.query_raw.await_args.args
    assert "$2::text IS NULL OR assignee" in sql
    assert "$3::bool IS NULL OR done" in sql
    assert params == ["w1", None, None, 10, 0]


@pytest.mark.asyncio
async def test_delete_returns_false_when_no_row():
    db = AsyncMock()
    db.store.query_raw = AsyncMock(return_value=[])
    repo = ActionItemsRepo(db)
    assert await repo.delete("a1", "w1") is False
