"""Pure coaching-scorecard computation over MeetingAnalytics.

Heuristics mirror what sales-coaching tools surface:
  * talk ratio (reps should listen more than they talk),
  * monologue risk (longest uninterrupted stretch),
  * discovery (questions asked),
  * filler-word hygiene,
  * conversation balance.
No LLM — fully testable and works offline.
"""

from __future__ import annotations

from typing import Any, Dict, List

# Tunable thresholds (sales-call oriented defaults).
_TALK_RATIO_HIGH = 0.55      # dominating the call
_MONOLOGUE_HIGH_SEC = 120.0  # 2-minute uninterrupted stretch
_LOW_QUESTIONS = 2
_GRADE_BANDS = [(90, "A"), (80, "B"), (70, "C"), (60, "D")]


def _grade(score: float) -> str:
    for cutoff, letter in _GRADE_BANDS:
        if score >= cutoff:
            return letter
    return "F"


def compute_coaching(analytics: Any) -> Dict[str, Any]:
    """`analytics` is a MeetingAnalytics model (has .speakers, .balance_score…)."""
    speakers = list(getattr(analytics, "speakers", []) or [])
    duration = float(getattr(analytics, "duration_sec", 0.0) or 0.0)
    balance = float(getattr(analytics, "balance_score", 0.0) or 0.0)
    question_count = int(getattr(analytics, "question_count", 0) or 0)
    longest = float(getattr(analytics, "longest_monologue_sec", 0.0) or 0.0)

    # The "rep" heuristic: whoever talked most. Real deployments map this via
    # speaker profiles; here we coach the dominant speaker.
    top = max(speakers, key=lambda s: getattr(s, "talk_ratio", 0.0), default=None)
    top_ratio = float(getattr(top, "talk_ratio", 0.0)) if top else 0.0

    tips: List[str] = []
    # Score starts at balance and is docked for anti-patterns.
    score = balance
    if top_ratio > _TALK_RATIO_HIGH and top is not None:
        tips.append(
            f"{top.speaker_name} spoke {round(top_ratio * 100)}% of the time — "
            f"aim to listen more than you talk."
        )
        score -= 15
    if longest > _MONOLOGUE_HIGH_SEC:
        tips.append(
            f"Longest monologue ran {int(longest // 60)}m{int(longest % 60):02d}s — "
            f"break it up with check-in questions."
        )
        score -= 10
    if question_count < _LOW_QUESTIONS:
        tips.append("Few questions asked — lead with more discovery questions.")
        score -= 10
    total_filler = sum(int(getattr(s, "filler_word_count", 0)) for s in speakers)
    if duration > 0 and total_filler / max(duration / 60.0, 1.0) > 8:
        tips.append("High filler-word rate — tighten delivery for clarity.")
        score -= 5
    if not tips:
        tips.append("Well-balanced conversation — keep it up.")

    score = max(0.0, min(100.0, score))

    per_speaker = [
        {
            "speaker_name": getattr(s, "speaker_name", "Unknown"),
            "talk_ratio": round(float(getattr(s, "talk_ratio", 0.0)), 3),
            "questions_asked": int(getattr(s, "questions_asked", 0)),
            "words_per_minute": round(float(getattr(s, "words_per_minute", 0.0))),
            "filler_word_count": int(getattr(s, "filler_word_count", 0)),
        }
        for s in speakers
    ]

    return {
        "meeting_id": getattr(analytics, "meeting_id", ""),
        "overall_grade": _grade(score),
        "overall_score": round(score, 1),
        "talk_ratio_top": round(top_ratio, 3),
        "longest_monologue_sec": longest,
        "question_count": question_count,
        "balance_score": round(balance, 1),
        "tips": tips,
        "per_speaker": per_speaker,
    }
