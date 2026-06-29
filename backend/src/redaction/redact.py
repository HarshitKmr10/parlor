"""Pure PII redaction over text and transcript segments.

Regex-based, deterministic, no model. Each detector is independently toggleable
via the policy mapping. Designed to run before transcripts reach the AI service,
embeddings, or public share pages.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Mapping, Sequence

_EMAIL = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
# Phone: optional +, country/area, 7+ digits with separators. Conservative.
_PHONE = re.compile(
    r"(?<!\d)(?:\+?\d{1,3}[\s.\-]?)?(?:\(\d{2,4}\)[\s.\-]?)?\d{3}[\s.\-]?\d{3,4}(?!\d)"
)
# Credit-card-ish: 13-16 digits, optional spaces/dashes in groups of 4.
_CARD = re.compile(r"(?<!\d)(?:\d[ \-]?){13,16}(?!\d)")

_EMAIL_TOKEN = "[redacted-email]"
_PHONE_TOKEN = "[redacted-phone]"
_CARD_TOKEN = "[redacted-card]"


def redact_text(text: str, policy: Mapping[str, Any]) -> str:
    if not text or not policy.get("redaction_enabled"):
        return text
    out = text
    # Cards first (longest digit runs) so phone regex doesn't fragment them.
    if policy.get("redact_cards", True):
        out = _CARD.sub(_CARD_TOKEN, out)
    if policy.get("redact_emails", True):
        out = _EMAIL.sub(_EMAIL_TOKEN, out)
    if policy.get("redact_phones", True):
        out = _PHONE.sub(_PHONE_TOKEN, out)
    return out


def redact_segments(
    segments: Sequence[Any], policy: Mapping[str, Any]
) -> List[Dict[str, Any]]:
    """Return new segment dicts with text fields redacted per policy."""
    if not policy.get("redaction_enabled"):
        return [dict(s) if isinstance(s, dict) else s for s in segments]
    out: List[Dict[str, Any]] = []
    for s in segments:
        seg = dict(s) if isinstance(s, dict) else s
        if isinstance(seg, dict):
            if "text" in seg and seg["text"]:
                seg["text"] = redact_text(str(seg["text"]), policy)
        out.append(seg)
    return out
