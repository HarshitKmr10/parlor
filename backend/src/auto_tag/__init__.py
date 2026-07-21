"""Auto-tag rules: auto-apply a meeting tag when a title matches a pattern.

``matcher`` is the pure, unit-tested core (validate + match); ``AutoTagRulesRepo``
persists workspace-scoped rules. Composes with the Meeting Tags feature — a match
adds a tag to the meeting alongside any tags already assigned.
"""

from .matcher import (
    AutoTagRule,
    InvalidAutoTagError,
    matching_tag_ids,
    rules_from_rows,
    validate_rule,
)
from .repo import AutoTagRulesRepo

__all__ = [
    "AutoTagRule",
    "InvalidAutoTagError",
    "AutoTagRulesRepo",
    "matching_tag_ids",
    "rules_from_rows",
    "validate_rule",
]
