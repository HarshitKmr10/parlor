"""Capture exclusions — do-not-record rules (workspace-scoped).

``matcher`` is the pure, unit-tested decision core (title/url pattern matching,
no side effects); ``CaptureExclusionsRepo`` persists the rules. The calendar
auto-join poller consults ``is_excluded`` before dispatching a bot so matching
meetings are never joined or recorded.
"""

from .matcher import (
    VALID_MATCH_TYPES,
    ExclusionRule,
    InvalidExclusionError,
    is_excluded,
    rules_from_rows,
    validate_rule,
)
from .repo import CaptureExclusionsRepo

__all__ = [
    "VALID_MATCH_TYPES",
    "ExclusionRule",
    "InvalidExclusionError",
    "is_excluded",
    "rules_from_rows",
    "validate_rule",
    "CaptureExclusionsRepo",
]
