"""Built-in summary-template presets users can create from.

Pure data + a lookup helper. Each preset has a stable ``key`` (for the create-
from-preset flow), a display ``name``, summarizer ``instructions`` and the
ordered ``sections`` the recap should contain.
"""

from __future__ import annotations

from typing import Dict, List, Optional

PRESETS: List[Dict[str, object]] = [
    {
        "key": "general",
        "name": "General meeting",
        "instructions": (
            "Summarize the meeting neutrally and concisely. Capture decisions, "
            "key discussion points and any follow-ups."
        ),
        "sections": ["Summary", "Key points", "Decisions", "Action items"],
    },
    {
        "key": "sales_call",
        "name": "Sales call",
        "instructions": (
            "Summarize as a sales call. Surface the prospect's pain points, "
            "budget/authority/need/timeline signals, objections raised, and "
            "agreed next steps. Be specific about commitments."
        ),
        "sections": [
            "Summary",
            "Pain points",
            "Objections",
            "Next steps",
            "Action items",
        ],
    },
    {
        "key": "standup",
        "name": "Daily standup",
        "instructions": (
            "Summarize as a standup: per person, what they did, what they will "
            "do next, and any blockers. Keep it terse."
        ),
        "sections": ["Updates", "Blockers", "Action items"],
    },
    {
        "key": "one_on_one",
        "name": "1:1",
        "instructions": (
            "Summarize a 1:1. Capture wins, concerns, feedback exchanged, growth "
            "topics and commitments made by either party. Keep tone private."
        ),
        "sections": ["Summary", "Wins", "Concerns", "Feedback", "Commitments"],
    },
    {
        "key": "interview",
        "name": "Candidate interview",
        "instructions": (
            "Summarize a candidate interview. Capture strengths, gaps, signal on "
            "each competency assessed, and a hiring recommendation. Stay neutral "
            "and evidence-based."
        ),
        "sections": [
            "Summary",
            "Strengths",
            "Gaps",
            "Competency signal",
            "Recommendation",
        ],
    },
]

_BY_KEY = {p["key"]: p for p in PRESETS}


def preset_by_key(key: str) -> Optional[Dict[str, object]]:
    return _BY_KEY.get(key)
