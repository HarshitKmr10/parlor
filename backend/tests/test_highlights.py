"""Unit tests for meeting highlights: excerpt extraction + repo SQL scoping."""

from dataclasses import dataclass
from unittest.mock import AsyncMock

import pytest

from src.highlights import HighlightsRepo, extract_excerpt


@dataclass
class Seg:
    speaker_name: str
    text: str
    t_start_sec: float
    t_end_sec: float


# ── extract_excerpt ─────────────────────────────────────────────────────────


def _segs():
    return [
        Seg("Alice", "Welcome everyone", 0.0, 5.0),
        Seg("Bob", "Thanks for having me", 5.0, 12.0),
        Seg("Alice", "Let's get started", 12.0, 18.0),
    ]


def test_excerpt_includes_only_overlapping_segments():
    out = extract_excerpt(_segs(), 4.0, 13.0)
    assert "Alice: Welcome everyone" in out  # ends at 5, overlaps 4..13
    assert "Bob: Thanks for having me" in out
    assert "Alice: Let's get started" in out  # starts at 12, overlaps


def test_excerpt_excludes_non_overlapping():
    out = extract_excerpt(_segs(), 6.0, 11.0)
    assert out == "Bob: Thanks for having me"


def test_excerpt_point_bookmark_matches_containing_segment():
    out = extract_excerpt(_segs(), 8.0, 8.0)
    assert out == "Bob: Thanks for having me"


def test_excerpt_empty_when_no_overlap():
    assert extract_excerpt(_segs(), 100.0, 200.0) == ""


def test_excerpt_skips_blank_text():
    segs = [Seg("Alice", "   ", 0.0, 5.0), Seg("Bob", "real", 5.0, 10.0)]
    assert extract_excerpt(segs, 0.0, 10.0) == "Bob: real"


def test_excerpt_truncates_to_max_chars():
    segs = [Seg("S", "x" * 50, float(i), float(i + 1)) for i in range(20)]
    out = extract_excerpt(segs, 0.0, 20.0, max_chars=120)
    assert out.endswith("…")
    assert len(out) <= 130  # bounded near the cap


# ── HighlightsRepo (mocked store) ───────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_passes_scoped_params():
    db = AsyncMock()
    db.store.query_raw = AsyncMock(
        return_value=[
            {
                "id": "h1",
                "meeting_id": "m1",
                "workspace_id": "w1",
                "created_by": "u1",
                "t_start_sec": 1.0,
                "t_end_sec": 2.0,
                "label": "Key moment",
                "note": None,
                "color": None,
                "excerpt": "Alice: hi",
                "created_at": "2026-01-01T00:00:00Z",
                "updated_at": "2026-01-01T00:00:00Z",
            }
        ]
    )
    repo = HighlightsRepo(db)
    row = await repo.create(
        meeting_id="m1",
        workspace_id="w1",
        created_by="u1",
        t_start_sec=1.0,
        t_end_sec=2.0,
        label="Key moment",
        note=None,
        color=None,
        excerpt="Alice: hi",
    )
    assert row["id"] == "h1"
    # workspace_id is passed as the 2nd positional param (scoping invariant).
    args = db.store.query_raw.await_args.args
    assert args[2] == "w1"


@pytest.mark.asyncio
async def test_list_for_meeting_is_workspace_scoped():
    db = AsyncMock()
    db.store.query_raw = AsyncMock(return_value=[])
    repo = HighlightsRepo(db)
    await repo.list_for_meeting("m1", "w1")
    sql, *params = db.store.query_raw.await_args.args
    assert "workspace_id = $2::uuid" in sql
    assert params == ["m1", "w1"]


@pytest.mark.asyncio
async def test_delete_returns_false_when_nothing_deleted():
    db = AsyncMock()
    db.store.query_raw = AsyncMock(return_value=[])
    repo = HighlightsRepo(db)
    assert await repo.delete("h1", "w1") is False


@pytest.mark.asyncio
async def test_get_normalizes_uuids_to_str():
    import uuid

    hid = uuid.uuid4()
    db = AsyncMock()
    db.store.query_raw = AsyncMock(
        return_value=[
            {
                "id": hid,
                "meeting_id": uuid.uuid4(),
                "workspace_id": uuid.uuid4(),
                "created_by": None,
                "t_start_sec": 0.0,
                "t_end_sec": 1.0,
                "label": None,
                "note": None,
                "color": None,
                "excerpt": None,
                "created_at": "2026-01-01T00:00:00Z",
                "updated_at": None,
            }
        ]
    )
    repo = HighlightsRepo(db)
    row = await repo.get(str(hid), "w1")
    assert isinstance(row["id"], str)
    assert row["created_by"] is None
