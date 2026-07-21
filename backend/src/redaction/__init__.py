"""PII redaction + per-workspace NLP settings.

`redact_text` / `redact_segments` are pure (unit-tested); `NlpSettingsRepo`
persists the fixed email/phone/card policy + custom vocabulary. The `engine`
module + `RedactionRulesRepo` add user-defined named redaction rules (regex /
keyword / extra builtin detectors) applied alongside that policy before AI
processing and on public share pages.
"""

from .engine import (
    BUILTIN_DETECTORS,
    InvalidRuleError,
    RedactionResult,
    RedactionRule,
    redact,
    rules_from_rows,
    validate_rule,
)
from .redact import redact_segments, redact_text
from .repo import NlpSettingsRepo
from .rules_repo import RedactionRulesRepo

__all__ = [
    "redact_segments",
    "redact_text",
    "NlpSettingsRepo",
    "RedactionRulesRepo",
    "redact",
    "rules_from_rows",
    "validate_rule",
    "RedactionRule",
    "RedactionResult",
    "InvalidRuleError",
    "BUILTIN_DETECTORS",
]
