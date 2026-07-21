"""Unit tests for the pure auto-tag matcher."""

from __future__ import annotations

import pytest

from src.auto_tag.matcher import (
    AutoTagRule,
    InvalidAutoTagError,
    matching_tag_ids,
    rules_from_rows,
    validate_rule,
)


def _rule(id="r1", pattern="standup", match_type="title_contains", tag_id="t1", enabled=True):
    return AutoTagRule(
        id=id, pattern=pattern, match_type=match_type, tag_id=tag_id, enabled=enabled
    )


def test_title_contains_matches_case_insensitively():
    rules = [_rule(pattern="Standup", tag_id="t1")]
    assert matching_tag_ids("Daily STANDUP sync", rules) == ["t1"]


def test_title_contains_no_match_returns_empty():
    rules = [_rule(pattern="retro", tag_id="t1")]
    assert matching_tag_ids("Weekly standup", rules) == []


def test_title_regex_matches():
    rules = [_rule(pattern=r"^\[SALES\]", match_type="title_regex", tag_id="sales")]
    assert matching_tag_ids("[SALES] Acme renewal", rules) == ["sales"]


def test_title_regex_is_case_insensitive():
    rules = [_rule(pattern=r"interview", match_type="title_regex", tag_id="hr")]
    assert matching_tag_ids("Onsite INTERVIEW loop", rules) == ["hr"]


def test_disabled_rule_is_skipped():
    rules = [_rule(pattern="standup", tag_id="t1", enabled=False)]
    assert matching_tag_ids("Daily standup", rules) == []


def test_dedup_preserves_order():
    rules = [
        _rule(id="a", pattern="standup", tag_id="t1"),
        _rule(id="b", pattern="daily", tag_id="t2"),
        _rule(id="c", pattern="sync", tag_id="t1"),  # duplicate tag id
    ]
    assert matching_tag_ids("Daily standup sync", rules) == ["t1", "t2"]


def test_empty_title_returns_empty():
    assert matching_tag_ids("", [_rule()]) == []


def test_bad_stored_regex_is_skipped_not_raised():
    good = _rule(id="good", pattern="ok", match_type="title_contains", tag_id="t1")
    bad = _rule(id="bad", pattern="(", match_type="title_regex", tag_id="t2")
    # Engine must never raise on bad persisted data (validation is at write time).
    assert matching_tag_ids("ok here", [bad, good]) == ["t1"]


def test_validate_rejects_bad_regex():
    with pytest.raises(InvalidAutoTagError):
        validate_rule("title_regex", "([a-z]")


def test_validate_rejects_empty_pattern():
    with pytest.raises(InvalidAutoTagError):
        validate_rule("title_contains", "   ")


def test_validate_rejects_unknown_match_type():
    with pytest.raises(InvalidAutoTagError):
        validate_rule("body_contains", "x")


def test_validate_accepts_good_rules():
    validate_rule("title_contains", "standup")
    validate_rule("title_regex", r"^\[SALES\]")


def test_rules_from_rows_adapts_db_rows():
    rows = [
        {
            "id": 1,
            "pattern": "standup",
            "match_type": "title_contains",
            "tag_id": 42,
            "enabled": True,
        },
    ]
    rules = rules_from_rows(rows)
    assert rules[0].id == "1"
    assert rules[0].tag_id == "42"
    assert rules[0].enabled is True
