"""Deterministic conversation analytics from diarized transcript segments.

The single public entry point is :func:`compute_meeting_analytics`. It accepts
any iterable of segment-like objects exposing ``speaker_name``, ``text``,
``t_start_sec`` and ``t_end_sec`` (the product ``TranscriptSegment`` model
satisfies this), and returns a fully-populated :class:`MeetingAnalytics`.

Everything here is pure and side-effect free so it is trivially unit-testable
and safe to call from a request handler without touching the DB or AI service.
"""

from __future__ import annotations

import math
import re
from datetime import datetime, timezone
from typing import Iterable, List, Protocol, Sequence

from ..api.product.schemas import MeetingAnalytics, SpeakerStat

# ── tuning constants ────────────────────────────────────────────────────────
# Filler words/phrases counted against fluency. Multi-word phrases first so the
# regex prefers the longer match.
_FILLER_TERMS: tuple[str, ...] = (
    "you know",
    "i mean",
    "sort of",
    "kind of",
    "um",
    "uh",
    "erm",
    "hmm",
    "like",
    "basically",
    "actually",
    "literally",
    "honestly",
)
_FILLER_RE = re.compile(
    r"\b(?:" + "|".join(re.escape(t) for t in _FILLER_TERMS) + r")\b",
    re.IGNORECASE,
)
_WORD_RE = re.compile(r"\b[\w'-]+\b")

# Lightweight sentiment lexicon. Heuristic by design — flagged as such in the
# API so consumers don't mistake it for a model-grade score.
_POSITIVE_WORDS: frozenset[str] = frozenset(
    {
        "great",
        "good",
        "excellent",
        "awesome",
        "amazing",
        "love",
        "love",
        "perfect",
        "fantastic",
        "happy",
        "glad",
        "agree",
        "agreed",
        "yes",
        "wonderful",
        "nice",
        "thanks",
        "thank",
        "appreciate",
        "excited",
        "win",
        "wins",
        "success",
        "successful",
        "improve",
        "improved",
        "better",
        "best",
        "helpful",
        "support",
        "definitely",
        "absolutely",
        "brilliant",
        "solid",
        "strong",
        "congrats",
        "congratulations",
    }
)
_NEGATIVE_WORDS: frozenset[str] = frozenset(
    {
        "bad",
        "terrible",
        "awful",
        "hate",
        "horrible",
        "problem",
        "problems",
        "issue",
        "issues",
        "concern",
        "concerned",
        "worried",
        "worry",
        "no",
        "disagree",
        "wrong",
        "fail",
        "failed",
        "failure",
        "broken",
        "bug",
        "bugs",
        "difficult",
        "hard",
        "blocked",
        "blocker",
        "delay",
        "delayed",
        "risk",
        "risky",
        "confused",
        "unfortunately",
        "unhappy",
        "frustrated",
        "stuck",
        "missed",
        "miss",
        "cant",
        "wont",
        "impossible",
        "worse",
        "worst",
    }
)

# Mapping turns/minute → 0..100 interactivity. ~10 turns/min reads as a lively,
# fully interactive conversation; beyond that it saturates.
_INTERACTIVITY_FULL_TPM = 10.0
_SENTIMENT_POS_THRESHOLD = 0.15
_SENTIMENT_NEG_THRESHOLD = -0.15


class _Segment(Protocol):
    speaker_name: str
    text: str
    t_start_sec: float
    t_end_sec: float


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _duration(seg: _Segment) -> float:
    return max(0.0, float(seg.t_end_sec) - float(seg.t_start_sec))


def _word_count(text: str) -> int:
    return len(_WORD_RE.findall(text or ""))


def _filler_count(text: str) -> int:
    return len(_FILLER_RE.findall(text or ""))


def _question_count(text: str) -> int:
    return (text or "").count("?")


def _sentiment_score(text: str) -> tuple[int, int]:
    """Return (positive_hits, negative_hits) from the lexicon."""
    pos = neg = 0
    for word in _WORD_RE.findall((text or "").lower()):
        if word in _POSITIVE_WORDS:
            pos += 1
        elif word in _NEGATIVE_WORDS:
            neg += 1
    return pos, neg


def _label_sentiment(score: float) -> str:
    if score >= _SENTIMENT_POS_THRESHOLD:
        return "positive"
    if score <= _SENTIMENT_NEG_THRESHOLD:
        return "negative"
    return "neutral"


def _wpm(words: int, seconds: float) -> float:
    if seconds <= 0:
        return 0.0
    return round(words / (seconds / 60.0), 1)


def _count_turns(segments: Sequence[_Segment]) -> dict[str, int]:
    """Count contiguous speaking turns per speaker (a run of same-speaker rows)."""
    turns: dict[str, int] = {}
    prev: str | None = None
    for seg in segments:
        name = seg.speaker_name or "Unknown"
        if name != prev:
            turns[name] = turns.get(name, 0) + 1
            prev = name
    return turns


def _longest_monologues(segments: Sequence[_Segment]) -> dict[str, float]:
    """Longest single uninterrupted run (seconds) per speaker."""
    longest: dict[str, float] = {}
    run_speaker: str | None = None
    run_start: float | None = None
    run_end: float | None = None

    def _flush() -> None:
        if run_speaker is not None and run_start is not None and run_end is not None:
            span = max(0.0, run_end - run_start)
            if span > longest.get(run_speaker, 0.0):
                longest[run_speaker] = span

    for seg in segments:
        name = seg.speaker_name or "Unknown"
        if name != run_speaker:
            _flush()
            run_speaker = name
            run_start = float(seg.t_start_sec)
        run_end = float(seg.t_end_sec)
    _flush()
    return longest


def _balance_score(talk_ratios: List[float]) -> float:
    """Normalized entropy of talk-time across speakers, scaled to 0..100.

    100 = perfectly even split; →0 = one speaker dominates. A single speaker has
    no balance to measure, so returns 0 (a pure monologue).
    """
    ratios = [r for r in talk_ratios if r > 0]
    n = len(ratios)
    if n <= 1:
        return 0.0
    entropy = -sum(r * math.log(r) for r in ratios)
    return round((entropy / math.log(n)) * 100.0, 1)


def compute_meeting_analytics(
    meeting_id: str, segments: Iterable[_Segment]
) -> MeetingAnalytics:
    """Compute :class:`MeetingAnalytics` from transcript segments."""
    seg_list: List[_Segment] = [
        s for s in segments if (s.text or "").strip() or _duration(s) > 0
    ]

    if not seg_list:
        return MeetingAnalytics(meeting_id=meeting_id, computed_at=_now())

    turns_by_speaker = _count_turns(seg_list)
    monologue_by_speaker = _longest_monologues(seg_list)

    # Per-speaker accumulators.
    talk_time: dict[str, float] = {}
    words: dict[str, int] = {}
    fillers: dict[str, int] = {}
    questions: dict[str, int] = {}
    pos_hits: dict[str, int] = {}
    neg_hits: dict[str, int] = {}

    for seg in seg_list:
        name = seg.speaker_name or "Unknown"
        talk_time[name] = talk_time.get(name, 0.0) + _duration(seg)
        words[name] = words.get(name, 0) + _word_count(seg.text)
        fillers[name] = fillers.get(name, 0) + _filler_count(seg.text)
        questions[name] = questions.get(name, 0) + _question_count(seg.text)
        p, n = _sentiment_score(seg.text)
        pos_hits[name] = pos_hits.get(name, 0) + p
        neg_hits[name] = neg_hits.get(name, 0) + n

    total_talk = sum(talk_time.values()) or 0.0
    starts = [float(s.t_start_sec) for s in seg_list]
    ends = [float(s.t_end_sec) for s in seg_list]
    duration = max(0.0, max(ends) - min(starts))

    speakers: List[SpeakerStat] = []
    for name in sorted(talk_time, key=lambda k: talk_time[k], reverse=True):
        p, n = pos_hits.get(name, 0), neg_hits.get(name, 0)
        s_score = round((p - n) / (p + n), 3) if (p + n) else 0.0
        tt = round(talk_time[name], 1)
        speakers.append(
            SpeakerStat(
                speaker_name=name,
                talk_time_sec=tt,
                talk_ratio=(
                    round(talk_time[name] / total_talk, 3) if total_talk else 0.0
                ),
                word_count=words.get(name, 0),
                words_per_minute=_wpm(words.get(name, 0), talk_time[name]),
                turns=turns_by_speaker.get(name, 0),
                longest_monologue_sec=round(monologue_by_speaker.get(name, 0.0), 1),
                questions_asked=questions.get(name, 0),
                filler_word_count=fillers.get(name, 0),
                sentiment=_label_sentiment(s_score),
                sentiment_score=s_score,
            )
        )

    total_words = sum(words.values())
    num_turns = sum(turns_by_speaker.values())
    tpm = round(num_turns / (duration / 60.0), 2) if duration > 0 else 0.0
    interactivity = round(min(100.0, (tpm / _INTERACTIVITY_FULL_TPM) * 100.0), 1)

    longest_speaker = (
        max(monologue_by_speaker, key=lambda k: monologue_by_speaker[k])
        if monologue_by_speaker
        else None
    )

    total_pos = sum(pos_hits.values())
    total_neg = sum(neg_hits.values())
    overall_score = (
        round((total_pos - total_neg) / (total_pos + total_neg), 3)
        if (total_pos + total_neg)
        else 0.0
    )

    return MeetingAnalytics(
        meeting_id=meeting_id,
        duration_sec=round(duration, 1),
        total_words=total_words,
        words_per_minute=_wpm(total_words, duration),
        num_speakers=len(talk_time),
        num_turns=num_turns,
        turns_per_minute=tpm,
        interactivity_score=interactivity,
        balance_score=_balance_score([s.talk_ratio for s in speakers]),
        longest_monologue_sec=round(max(monologue_by_speaker.values(), default=0.0), 1),
        longest_monologue_speaker=longest_speaker,
        question_count=sum(questions.values()),
        filler_word_count=sum(fillers.values()),
        overall_sentiment=_label_sentiment(overall_score),
        overall_sentiment_score=overall_score,
        speakers=speakers,
        computed_at=_now(),
    )
