"""Unit tests for the pure capture-exclusion matcher."""

from __future__ import annotations

import pytest

from src.capture_exclusions.matcher import (
    ExclusionRule,
    InvalidExclusionError,
    is_excluded,
    rules_from_rows,
    validate_rule,
)


def _rule(id="r1", pattern="1:1", match_type="title_contains", note=None, enabled=True):
    return ExclusionRule(
        id=id, pattern=pattern, match_type=match_type, note=note, enabled=enabled
    )


def test_title_contains_matches():
    excluded, rule_id = is_excluded(
        "Weekly 1:1 with Sam",
        "https://meet.google.com/abc",
        [_rule(pattern="1:1")],
    )
    assert excluded is True
    assert rule_id == "r1"


def test_title_contains_no_match_returns_none():
    excluded, rule_id = is_excluded(
        "Team standup",
        "https://meet.google.com/abc",
        [_rule(pattern="1:1")],
    )
    assert excluded is False
    assert rule_id is None


def test_title_contains_is_case_insensitive():
    excluded, _ = is_excluded(
        "Board MEETING",
        "https://zoom.us/j/1",
        [_rule(pattern="board meeting")],
    )
    assert excluded is True


def test_url_contains_matches():
    excluded, rule_id = is_excluded(
        "Some meeting",
        "https://zoom.us/j/private-room",
        [_rule(id="u1", pattern="private-room", match_type="url_contains")],
    )
    assert excluded is True
    assert rule_id == "u1"


def test_url_contains_is_case_insensitive():
    excluded, _ = is_excluded(
        "x",
        "https://ZOOM.us/j/SECRET",
        [_rule(pattern="secret", match_type="url_contains")],
    )
    assert excluded is True


def test_title_regex_matches_title_only():
    rules = [_rule(id="rx", pattern=r"^\[HR\]", match_type="title_regex")]
    excluded, rule_id = is_excluded("[HR] Review", "https://meet.google.com/x", rules)
    assert excluded is True
    assert rule_id == "rx"


def test_title_regex_does_not_match_url():
    # A regex rule matches the title only — never the URL.
    rules = [_rule(pattern=r"confidential", match_type="title_regex")]
    excluded, _ = is_excluded(
        "Normal sync", "https://meet.google.com/confidential-room", rules
    )
    assert excluded is False


def test_title_regex_is_case_insensitive():
    rules = [_rule(pattern=r"interview", match_type="title_regex")]
    excluded, _ = is_excluded("Candidate INTERVIEW", "", rules)
    assert excluded is True


def test_disabled_rule_is_skipped():
    excluded, rule_id = is_excluded(
        "Weekly 1:1", "https://meet.google.com/x", [_rule(pattern="1:1", enabled=False)]
    )
    assert excluded is False
    assert rule_id is None


def test_first_matching_rule_wins():
    rules = [
        _rule(id="a", pattern="standup"),
        _rule(id="b", pattern="1:1"),
    ]
    excluded, rule_id = is_excluded("Daily standup 1:1", "", rules)
    assert excluded is True
    assert rule_id == "a"


def test_none_title_and_url_are_safe():
    excluded, rule_id = is_excluded(None, None, [_rule(pattern="1:1")])
    assert excluded is False
    assert rule_id is None


def test_bad_stored_regex_is_skipped_not_raised():
    # Matcher must never raise on bad persisted data (validation is at write time).
    bad = _rule(id="bad", pattern="([a-z]", match_type="title_regex")
    good = _rule(id="good", pattern="secret", match_type="title_contains")
    excluded, rule_id = is_excluded("secret meeting", "", [bad, good])
    assert excluded is True
    assert rule_id == "good"


def test_validate_rejects_unknown_match_type():
    with pytest.raises(InvalidExclusionError):
        validate_rule("body_contains", "x")


def test_validate_rejects_empty_pattern():
    with pytest.raises(InvalidExclusionError):
        validate_rule("title_contains", "   ")


def test_validate_rejects_bad_regex():
    with pytest.raises(InvalidExclusionError):
        validate_rule("title_regex", "([a-z]")


def test_validate_accepts_good_regex():
    validate_rule("title_regex", r"^\[HR\].*")


def test_validate_accepts_literal_types():
    validate_rule("title_contains", "1:1")
    validate_rule("url_contains", "zoom.us")


def test_rules_from_rows_adapts_db_rows():
    rows = [
        {
            "id": 7,
            "pattern": "1:1",
            "match_type": "title_contains",
            "note": None,
            "enabled": True,
        },
    ]
    rules = rules_from_rows(rows)
    assert rules[0].id == "7"
    assert rules[0].note is None
    assert rules[0].enabled is True
    assert rules[0].match_type == "title_contains"
