"""Unit tests for summary templates: presets, meta projection, repo."""

from unittest.mock import AsyncMock

import pytest

from src.summary_templates import (
    PRESETS,
    SummaryTemplatesRepo,
    preset_by_key,
    template_to_meta,
)

# ── presets ─────────────────────────────────────────────────────────────────


def test_presets_have_required_shape():
    for p in PRESETS:
        assert {"key", "name", "instructions", "sections"} <= set(p)
        assert isinstance(p["sections"], list) and p["sections"]


def test_preset_by_key_found_and_missing():
    assert preset_by_key("sales_call")["name"] == "Sales call"
    assert preset_by_key("nope") is None


def test_preset_keys_unique():
    keys = [p["key"] for p in PRESETS]
    assert len(keys) == len(set(keys))


# ── meta projection ─────────────────────────────────────────────────────────


def test_template_to_meta_none_is_none():
    assert template_to_meta(None) is None
    assert template_to_meta({}) is None


def test_template_to_meta_shapes_fields():
    meta = template_to_meta(
        {"name": "Sales", "instructions": "do x", "sections": ["A", "B"]}
    )
    assert meta == {"name": "Sales", "instructions": "do x", "sections": ["A", "B"]}


def test_template_to_meta_tolerates_missing_keys():
    meta = template_to_meta({"name": "X"})
    assert meta == {"name": "X", "instructions": "", "sections": []}


# ── repo ────────────────────────────────────────────────────────────────────


def _row(**over):
    base = {
        "id": "t1",
        "workspace_id": "w1",
        "created_by": None,
        "name": "T",
        "instructions": "",
        "sections": [],
        "is_default": False,
        "created_at": None,
        "updated_at": None,
    }
    base.update(over)
    return base


@pytest.mark.asyncio
async def test_create_default_clears_existing_default_first():
    db = AsyncMock()
    db.store.query_raw = AsyncMock(return_value=[_row(is_default=True)])
    repo = SummaryTemplatesRepo(db)
    await repo.create(
        workspace_id="w1",
        created_by=None,
        name="Default one",
        instructions="x",
        sections=["S"],
        is_default=True,
    )
    # First call clears any existing default, second inserts.
    calls = db.store.query_raw.await_args_list
    assert "is_default = FALSE" in calls[0].args[0]
    assert "INSERT INTO summary_templates" in calls[1].args[0]


@pytest.mark.asyncio
async def test_create_nondefault_does_not_clear():
    db = AsyncMock()
    db.store.query_raw = AsyncMock(return_value=[_row()])
    repo = SummaryTemplatesRepo(db)
    await repo.create(
        workspace_id="w1",
        created_by=None,
        name="Plain",
        instructions="",
        sections=[],
        is_default=False,
    )
    assert db.store.query_raw.await_count == 1  # no clear step


@pytest.mark.asyncio
async def test_get_default_is_workspace_scoped():
    db = AsyncMock()
    db.store.query_raw = AsyncMock(return_value=[])
    repo = SummaryTemplatesRepo(db)
    await repo.get_default("w1")
    sql, *params = db.store.query_raw.await_args.args
    assert "workspace_id = $1::uuid" in sql and "is_default = TRUE" in sql
    assert params == ["w1"]


@pytest.mark.asyncio
async def test_delete_returns_false_when_no_row():
    db = AsyncMock()
    db.store.query_raw = AsyncMock(return_value=[])
    repo = SummaryTemplatesRepo(db)
    assert await repo.delete("t1", "w1") is False


@pytest.mark.asyncio
async def test_norm_stringifies_uuids_and_lists_sections():
    import uuid

    db = AsyncMock()
    db.store.query_raw = AsyncMock(
        return_value=[_row(id=uuid.uuid4(), workspace_id=uuid.uuid4(), sections=None)]
    )
    repo = SummaryTemplatesRepo(db)
    row = await repo.get("t1", "w1")
    assert isinstance(row["id"], str)
    assert row["sections"] == []
