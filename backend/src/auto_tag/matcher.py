"""Pure, dependency-free auto-tag matcher.

Auto-tag rules automatically apply a meeting tag when a meeting's title matches
a pattern. This module is the deterministic core of that — no DB, no network,
no side effects — so it is trivially unit-testable and safe to call from the
summarize pipeline as well as from the CRUD endpoint's validation.

A rule matches one of two ways:

- ``title_contains`` — ``pattern`` is a literal, case-insensitive substring of
  the meeting title.
- ``title_regex``    — ``pattern`` is a Python regular expression searched
  (case-insensitive) against the title.

``matching_tag_ids()`` returns the tag ids of every enabled rule that matches a
given title, deduped and in the order the rules were supplied.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import List, Mapping, Sequence

VALID_MATCH_TYPES = ("title_contains", "title_regex")

MAX_PATTERN_LENGTH = 500


class InvalidAutoTagError(ValueError):
    """Raised when a rule's match_type/pattern is not usable."""


@dataclass(frozen=True)
class AutoTagRule:
    id: str
    pattern: str
    match_type: str
    tag_id: str
    enabled: bool = True


def validate_rule(match_type: str, pattern: str) -> None:
    """Raise InvalidAutoTagError if (match_type, pattern) is not usable.

    Rejects an unknown match_type, an empty pattern, a pattern over
    MAX_PATTERN_LENGTH, or an uncompilable regex. No return.
    """
    if match_type not in VALID_MATCH_TYPES:
        raise InvalidAutoTagError(f"Unknown match type: {match_type!r}")
    if not pattern or not pattern.strip():
        raise InvalidAutoTagError("Pattern must not be empty.")
    if len(pattern) > MAX_PATTERN_LENGTH:
        raise InvalidAutoTagError(
            f"Pattern exceeds {MAX_PATTERN_LENGTH} characters."
        )
    if match_type == "title_regex":
        try:
            re.compile(pattern, re.IGNORECASE)
        except re.error as exc:
            raise InvalidAutoTagError(f"Invalid regular expression: {exc}") from exc


def _rule_matches(title: str, rule: AutoTagRule) -> bool:
    """Return True if an enabled rule matches the title. Never raises."""
    if rule.match_type == "title_contains":
        return rule.pattern.lower() in title.lower()
    if rule.match_type == "title_regex":
        try:
            return re.search(rule.pattern, title, re.IGNORECASE) is not None
        except re.error:
            # Never raise on bad stored data — validation happens at write time.
            return False
    return False


def matching_tag_ids(title: str, rules: Sequence[AutoTagRule]) -> List[str]:
    """Return tag ids of every enabled rule matching ``title``.

    Case-insensitive. Deduplicates tag ids while preserving the order in which
    the matching rules appear. A disabled rule is skipped; a rule with a bad
    stored regex is treated as non-matching (never raises).
    """
    out: List[str] = []
    if not title:
        return out
    for rule in rules:
        if not rule.enabled:
            continue
        if _rule_matches(title, rule) and rule.tag_id not in out:
            out.append(rule.tag_id)
    return out


def rules_from_rows(rows: Sequence[Mapping[str, object]]) -> List[AutoTagRule]:
    """Adapt raw DB rows (or dicts) into AutoTagRule instances."""
    out: List[AutoTagRule] = []
    for row in rows:
        out.append(
            AutoTagRule(
                id=str(row["id"]),
                pattern=str(row["pattern"]),
                match_type=str(row["match_type"]),
                tag_id=str(row["tag_id"]),
                enabled=bool(row["enabled"]),
            )
        )
    return out
