"""Pure, dependency-free capture-exclusion matcher.

Parlor's privacy stance is local-first: some meetings should never be
auto-joined or recorded at all. This module is the deterministic core of that
"do-not-record" decision — no DB, no network, no side effects — so it is
trivially unit-testable and safe to call from a hot path (the calendar
auto-join poller) as well as from any preview.

A rule matches a meeting by its title or URL:

- ``title_contains`` — ``pattern`` is a literal, case-insensitive substring of
  the meeting title.
- ``url_contains``   — ``pattern`` is a literal, case-insensitive substring of
  the meeting URL.
- ``title_regex``    — ``pattern`` is a Python regular expression matched
  (case-insensitively) against the meeting title only.

``is_excluded()`` returns whether any enabled rule matched and, if so, the id
of the first matching rule.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import List, Mapping, Optional, Sequence, Tuple

VALID_MATCH_TYPES = ("title_contains", "url_contains", "title_regex")

MAX_PATTERN_LENGTH = 500


class InvalidExclusionError(ValueError):
    """Raised when an exclusion rule's pattern/match_type is not usable."""


@dataclass(frozen=True)
class ExclusionRule:
    id: str
    pattern: str
    match_type: str = "title_contains"
    note: Optional[str] = None
    enabled: bool = True


def validate_rule(match_type: str, pattern: str) -> None:
    """Raise InvalidExclusionError if (match_type, pattern) is not usable.

    Rejects an unknown match type, an empty pattern, a pattern over
    MAX_PATTERN_LENGTH, or (for ``title_regex``) an uncompilable regex.
    """
    if match_type not in VALID_MATCH_TYPES:
        raise InvalidExclusionError(f"Unknown match type: {match_type!r}")
    if not pattern or not pattern.strip():
        raise InvalidExclusionError("Pattern must not be empty.")
    if len(pattern) > MAX_PATTERN_LENGTH:
        raise InvalidExclusionError(
            f"Pattern exceeds {MAX_PATTERN_LENGTH} characters."
        )
    if match_type == "title_regex":
        try:
            re.compile(pattern, re.IGNORECASE)
        except re.error as exc:
            raise InvalidExclusionError(
                f"Invalid regular expression: {exc}"
            ) from exc


def _rule_matches(rule: ExclusionRule, title: str, url: str) -> bool:
    if rule.match_type == "title_contains":
        return rule.pattern.strip().lower() in title.lower()
    if rule.match_type == "url_contains":
        return rule.pattern.strip().lower() in url.lower()
    if rule.match_type == "title_regex":
        try:
            regex = re.compile(rule.pattern, re.IGNORECASE)
        except re.error:
            # Never raise on bad persisted data — validation happens at write
            # time via validate_rule; a broken stored rule is simply skipped.
            return False
        return regex.search(title) is not None
    return False


def is_excluded(
    title: Optional[str],
    url: Optional[str],
    rules: Sequence[ExclusionRule],
) -> Tuple[bool, Optional[str]]:
    """Return (excluded, matched_rule_id) for the given meeting title/url.

    The first enabled rule that matches wins. Matching is case-insensitive.
    Disabled rules and rules with an unknown/uncompilable pattern are skipped.
    """
    safe_title = title or ""
    safe_url = url or ""
    for rule in rules:
        if not rule.enabled:
            continue
        if _rule_matches(rule, safe_title, safe_url):
            return True, rule.id
    return False, None


def rules_from_rows(rows: Sequence[Mapping[str, object]]) -> List[ExclusionRule]:
    """Adapt raw DB rows (or dicts) into ExclusionRule instances."""
    out: List[ExclusionRule] = []
    for row in rows:
        note = row.get("note")
        out.append(
            ExclusionRule(
                id=str(row["id"]),
                pattern=str(row["pattern"]),
                match_type=str(row["match_type"]),
                note=str(note) if note is not None else None,
                enabled=bool(row["enabled"]),
            )
        )
    return out
