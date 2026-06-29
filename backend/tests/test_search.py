"""Unit tests for cross-meeting keyword search logic."""

from dataclasses import dataclass
from unittest.mock import AsyncMock

import pytest

from src.search import SearchRepo, find_segment_matches, make_snippet, score_meeting
from src.search.repo import _escape_like


@dataclass
class Seg:
    id: str
    speaker_name: str
    text: str
    t_start_sec: float
    t_end_sec: float


def _segs():
    return [
        Seg("s1", "Alice", "Let's talk about pricing for the new plan", 0.0, 5.0),
        Seg("s2", "Bob", "I think the pricing is too high honestly", 5.0, 10.0),
        Seg("s3", "Alice", "Unrelated chatter about lunch", 10.0, 15.0),
    ]


# ── make_snippet ────────────────────────────────────────────────────────────


def test_make_snippet_marks_match():
    out = make_snippet("the quick brown fox", "brown")
    assert "<mark>brown</mark>" in out


def test_make_snippet_case_insensitive():
    out = make_snippet("PRICING discussion", "pricing")
    assert "<mark>PRICING</mark>" in out  # preserves original casing


def test_make_snippet_windows_long_text():
    text = "x" * 200 + "needle" + "y" * 200
    out = make_snippet(text, "needle", context_chars=20)
    assert out.startswith("…")
    assert out.endswith("…")
    assert "<mark>needle</mark>" in out


def test_make_snippet_no_match_returns_head():
    out = make_snippet("some text here", "absent")
    assert "<mark>" not in out
    assert "some text" in out


# ── find_segment_matches ────────────────────────────────────────────────────


def test_find_matches_counts_hits_and_orders_by_time():
    snippets, total = find_segment_matches(_segs(), "pricing")
    assert total == 2  # two segments mention pricing once each
    assert len(snippets) == 2
    assert snippets[0]["tStartSec"] == 0.0  # time-ordered
    assert "<mark>pricing</mark>" in snippets[0]["snippet"]


def test_find_matches_empty_query():
    snippets, total = find_segment_matches(_segs(), "  ")
    assert snippets == [] and total == 0


def test_find_matches_caps_snippets():
    segs = [Seg(f"s{i}", "X", "needle here", float(i), float(i + 1)) for i in range(10)]
    snippets, total = find_segment_matches(segs, "needle", max_snippets=3)
    assert total == 10
    assert len(snippets) == 3


# ── score_meeting ───────────────────────────────────────────────────────────


def test_score_weights_title_highest():
    title_score = score_meeting(
        transcript_hits=0, title="Pricing review", summary="", query="pricing"
    )
    summary_score = score_meeting(
        transcript_hits=0, title="", summary="we discussed pricing", query="pricing"
    )
    transcript_score = score_meeting(
        transcript_hits=1, title="", summary="", query="pricing"
    )
    assert title_score > summary_score > transcript_score


def test_score_zero_when_no_match():
    assert (
        score_meeting(transcript_hits=0, title="x", summary="y", query="pricing") == 0
    )


# ── _escape_like ────────────────────────────────────────────────────────────


def test_escape_like_neutralizes_wildcards():
    assert _escape_like("100%_done") == "100\\%\\_done"
    assert _escape_like("a\\b") == "a\\\\b"


# ── SearchRepo (mocked) ─────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_search_candidates_is_workspace_scoped_and_escaped():
    db = AsyncMock()
    db.store.query_raw = AsyncMock(return_value=[])
    repo = SearchRepo(db)
    await repo.search_candidates("w1", "50%", limit=25)
    sql, *params = db.store.query_raw.await_args.args
    assert "workspace_id = $1::uuid" in sql
    assert params[0] == "w1"
    assert params[1] == "%50\\%%"  # wildcard in query escaped, framed by % %
    assert params[2] == 25
