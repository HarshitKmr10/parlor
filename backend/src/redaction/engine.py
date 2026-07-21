"""Pure, dependency-free redaction engine.

Parlor's privacy stance is local-first: sensitive strings should be scrubbed
from a transcript *before* it is embedded, summarized, or sent to any model
provider. This module is the deterministic core of that — no DB, no network,
no side effects — so it is trivially unit-testable and safe to call from a hot
path (the summarize/embed pipeline) as well as from the preview endpoint.

A rule is one of three kinds:

- ``builtin``  — a named detector (see ``BUILTIN_DETECTORS``): email, phone,
  credit_card, ssn, ipv4. ``pattern`` holds the detector key.
- ``regex``    — a caller-supplied Python regular expression in ``pattern``.
- ``keyword``  — a literal, case-insensitive substring in ``pattern``.

``redact()`` returns the scrubbed text plus per-rule match counts so callers
(and the UI preview) can show exactly what was removed and by which rule.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Dict, List, Mapping, Sequence

VALID_KINDS = ("builtin", "regex", "keyword")

# Detector patterns are kept deliberately simple/linear to avoid catastrophic
# backtracking — they run over full transcripts. Keys are the stable public
# API used as `pattern` when kind == "builtin".
BUILTIN_DETECTORS: Dict[str, str] = {
    "email": r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}",
    "phone": r"(?<!\d)(?:\+?\d{1,3}[\s.\-]?)?(?:\(\d{2,4}\)[\s.\-]?)?\d{3}[\s.\-]?\d{3,4}(?!\d)",
    "credit_card": r"(?<!\d)(?:\d[ \-]?){13,16}(?!\d)",
    "ssn": r"(?<!\d)\d{3}-\d{2}-\d{4}(?!\d)",
    "ipv4": r"(?<!\d)(?:\d{1,3}\.){3}\d{1,3}(?!\d)",
}

DEFAULT_REPLACEMENT = "[REDACTED]"
MAX_PATTERN_LENGTH = 500


class InvalidRuleError(ValueError):
    """Raised when a rule's pattern cannot be compiled/resolved."""


@dataclass(frozen=True)
class RedactionRule:
    id: str
    name: str
    kind: str
    pattern: str
    replacement: str = DEFAULT_REPLACEMENT
    enabled: bool = True


@dataclass
class RedactionResult:
    text: str
    total_redactions: int = 0
    per_rule: Dict[str, int] = field(default_factory=dict)


def compile_rule(kind: str, pattern: str) -> "re.Pattern[str]":
    """Resolve a (kind, pattern) pair to a compiled, case-insensitive regex.

    Raises InvalidRuleError for an unknown builtin key, an uncompilable regex,
    an empty pattern, or a pattern over MAX_PATTERN_LENGTH.
    """
    if kind not in VALID_KINDS:
        raise InvalidRuleError(f"Unknown rule kind: {kind!r}")
    if not pattern or not pattern.strip():
        raise InvalidRuleError("Pattern must not be empty.")
    if len(pattern) > MAX_PATTERN_LENGTH:
        raise InvalidRuleError(
            f"Pattern exceeds {MAX_PATTERN_LENGTH} characters."
        )

    if kind == "builtin":
        source = BUILTIN_DETECTORS.get(pattern.strip())
        if source is None:
            raise InvalidRuleError(f"Unknown builtin detector: {pattern!r}")
    elif kind == "keyword":
        source = re.escape(pattern)
    else:  # regex
        source = pattern

    try:
        return re.compile(source, re.IGNORECASE)
    except re.error as exc:  # invalid caller-supplied regex
        raise InvalidRuleError(f"Invalid regular expression: {exc}") from exc


def validate_rule(kind: str, pattern: str) -> None:
    """Raise InvalidRuleError if (kind, pattern) is not usable. No return."""
    compile_rule(kind, pattern)


def redact(text: str, rules: Sequence[RedactionRule]) -> RedactionResult:
    """Apply every enabled rule to ``text``, in order, returning the result.

    Rules are applied sequentially so a later rule sees the output of earlier
    ones. A rule that fails to compile is skipped (the engine never raises on
    bad stored data — validation happens at write time via validate_rule).
    """
    if not text:
        return RedactionResult(text=text)

    current = text
    per_rule: Dict[str, int] = {}
    total = 0

    for rule in rules:
        if not rule.enabled:
            continue
        try:
            regex = compile_rule(rule.kind, rule.pattern)
        except InvalidRuleError:
            continue
        replacement = rule.replacement or DEFAULT_REPLACEMENT
        current, count = regex.subn(lambda _m, r=replacement: r, current)
        if count:
            per_rule[rule.id] = per_rule.get(rule.id, 0) + count
            total += count

    return RedactionResult(text=current, total_redactions=total, per_rule=per_rule)


def rules_from_rows(rows: Sequence[Mapping[str, object]]) -> List[RedactionRule]:
    """Adapt raw DB rows (or dicts) into RedactionRule instances."""
    out: List[RedactionRule] = []
    for row in rows:
        out.append(
            RedactionRule(
                id=str(row["id"]),
                name=str(row["name"]),
                kind=str(row["kind"]),
                pattern=str(row["pattern"]),
                replacement=str(row.get("replacement") or DEFAULT_REPLACEMENT),
                enabled=bool(row["enabled"]),
            )
        )
    return out
