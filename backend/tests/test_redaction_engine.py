"""Unit tests for the pure custom-redaction engine."""

from __future__ import annotations

import pytest

from src.redaction.engine import (
    BUILTIN_DETECTORS,
    InvalidRuleError,
    RedactionRule,
    compile_rule,
    redact,
    rules_from_rows,
    validate_rule,
)


def _rule(id="r1", name="n", kind="keyword", pattern="secret", replacement="[X]", enabled=True):
    return RedactionRule(id=id, name=name, kind=kind, pattern=pattern, replacement=replacement, enabled=enabled)


def test_keyword_rule_is_case_insensitive():
    result = redact("Secret and SECRET and secret", [_rule(pattern="secret", replacement="[X]")])
    assert result.text == "[X] and [X] and [X]"
    assert result.total_redactions == 3
    assert result.per_rule["r1"] == 3


def test_keyword_rule_is_literal_not_regex():
    # A '.' in a keyword must match a literal dot, not any char.
    result = redact("a.b axb", [_rule(pattern="a.b", replacement="[X]")])
    assert result.text == "[X] axb"
    assert result.total_redactions == 1


def test_builtin_email_detector():
    result = redact(
        "reach me at jane.doe@example.com please",
        [_rule(kind="builtin", pattern="email", replacement="[email]")],
    )
    assert result.text == "reach me at [email] please"


def test_builtin_ssn_detector():
    result = redact(
        "SSN 123-45-6789 on file",
        [_rule(kind="builtin", pattern="ssn", replacement="[ssn]")],
    )
    assert result.text == "SSN [ssn] on file"


def test_regex_rule():
    result = redact(
        "ticket ABC-123 and ABC-999",
        [_rule(kind="regex", pattern=r"ABC-\d+", replacement="[ticket]")],
    )
    assert result.text == "ticket [ticket] and [ticket]"
    assert result.total_redactions == 2


def test_rules_apply_in_sequence():
    rules = [
        _rule(id="a", pattern="alpha", replacement="X"),
        _rule(id="b", pattern="X", replacement="Y"),
    ]
    # First rule turns 'alpha' -> 'X', second turns that 'X' -> 'Y'.
    result = redact("alpha", rules)
    assert result.text == "Y"


def test_disabled_rule_is_skipped():
    result = redact("secret", [_rule(pattern="secret", enabled=False)])
    assert result.text == "secret"
    assert result.total_redactions == 0


def test_empty_text_returns_unchanged():
    result = redact("", [_rule()])
    assert result.text == ""
    assert result.total_redactions == 0


def test_default_replacement_used_when_blank():
    result = redact("secret", [_rule(pattern="secret", replacement="")])
    assert result.text == "[REDACTED]"


def test_bad_stored_regex_is_skipped_not_raised():
    # Engine must never raise on bad persisted data (validation is at write time).
    good = _rule(id="good", pattern="ok", replacement="[X]")
    bad = _rule(id="bad", kind="regex", pattern="(", replacement="[Y]")
    result = redact("ok here", [bad, good])
    assert result.text == "[X] here"
    assert "bad" not in result.per_rule


@pytest.mark.parametrize("key", list(BUILTIN_DETECTORS))
def test_all_builtins_compile(key):
    compile_rule("builtin", key)


def test_validate_rejects_unknown_builtin():
    with pytest.raises(InvalidRuleError):
        validate_rule("builtin", "not_a_detector")


def test_validate_rejects_bad_regex():
    with pytest.raises(InvalidRuleError):
        validate_rule("regex", "([a-z]")


def test_validate_rejects_empty_pattern():
    with pytest.raises(InvalidRuleError):
        validate_rule("keyword", "   ")


def test_validate_rejects_unknown_kind():
    with pytest.raises(InvalidRuleError):
        validate_rule("bogus", "x")


def test_rules_from_rows_adapts_db_rows():
    rows = [
        {"id": 1, "name": "n", "kind": "keyword", "pattern": "p", "replacement": None, "enabled": True},
    ]
    rules = rules_from_rows(rows)
    assert rules[0].id == "1"
    assert rules[0].replacement == "[REDACTED]"
    assert rules[0].enabled is True
