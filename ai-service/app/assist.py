"""Proactive during-call assist — deterministic, no LLM required.

Given the transcript captured so far, surface:
  * a one-line "so far" recap,
  * suggested follow-up questions (grounded in what's been said),
  * coverage gaps (standard meeting checkpoints not yet touched).

Deterministic like analytics, so it works with or without model keys and is
trivially unit-testable.
"""

from __future__ import annotations

import re
from typing import Any, List, Sequence

# Standard checkpoints a well-run meeting tends to cover.
_CHECKPOINTS = [
    ("next steps", ["next step", "action item", "follow up", "follow-up", "i will", "we will", "owns", "by friday", "deadline"]),
    ("owners", ["owns", "own the", "will own", "i own", "owner", "responsible", "assigned", "i'll take", "i will take"]),
    ("timeline", ["timeline", "deadline", "by ", "due", "schedule", "when ", "date"]),
    ("risks/blockers", ["risk", "blocker", "blocked", "concern", "worried", "issue"]),
    ("decision", ["decide", "decision", "agreed", "let's go with", "we'll do"]),
]

_BASE_QUESTIONS = [
    "What are the agreed next steps and who owns each?",
    "Is there a deadline or timeline we've committed to?",
    "Are there any open risks or blockers to flag?",
]


def _text_of(seg: Any) -> str:
    return str(getattr(seg, "text", "") or "")


def compute_assist(segments: Sequence[Any]) -> dict:
    joined = " ".join(_text_of(s) for s in segments).lower()

    # Coverage gaps: checkpoints with no keyword hit yet.
    gaps: List[str] = []
    for label, keywords in _CHECKPOINTS:
        if not any(kw in joined for kw in keywords):
            gaps.append(label)

    # Suggested questions: prioritise prompts that target the gaps, then base.
    suggested: List[str] = []
    gap_set = set(gaps)
    if "next steps" in gap_set or "owners" in gap_set:
        suggested.append("What are the agreed next steps and who owns each?")
    if "timeline" in gap_set:
        suggested.append("What's our timeline or deadline for this?")
    if "risks/blockers" in gap_set:
        suggested.append("Are there any risks or blockers we should capture?")
    for q in _BASE_QUESTIONS:
        if q not in suggested:
            suggested.append(q)
    suggested = suggested[:3]

    # "So far" recap: most recent substantive sentence.
    recap = ""
    for s in reversed(segments):
        t = _text_of(s).strip()
        if len(t) >= 12:
            # First sentence of the most recent meaningful segment.
            recap = re.split(r"(?<=[.!?])\s", t)[0]
            break

    return {
        "summary_so_far": recap,
        "suggested_questions": suggested,
        "coverage_gaps": gaps,
        "segment_count": len(segments),
    }
