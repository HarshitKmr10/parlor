"""Pure keyword-match + snippet helpers for cross-meeting search.

No DB, no I/O — given parsed transcript segments and a query, produce ranked
matches with highlighted context windows. Matches are wrapped in ``<mark>…
</mark>`` so the frontend can style them; everything else is escaped-safe plain
text taken verbatim from the transcript.
"""

from __future__ import annotations

from typing import Iterable, List, Protocol, Tuple

_CONTEXT_CHARS = 60
_MARK_OPEN = "<mark>"
_MARK_CLOSE = "</mark>"

# Relative weights: a title hit is the strongest relevance signal, a summary hit
# next, then raw transcript occurrences.
_TITLE_WEIGHT = 5
_SUMMARY_WEIGHT = 2


class _Segment(Protocol):
    id: str
    speaker_name: str
    text: str
    t_start_sec: float
    t_end_sec: float


def _count(haystack: str, needle: str) -> int:
    if not needle:
        return 0
    return haystack.lower().count(needle.lower())


def make_snippet(text: str, query: str, context_chars: int = _CONTEXT_CHARS) -> str:
    """Return a context window around the first match with the term marked.

    Falls back to the head of ``text`` if the query isn't present.
    """
    if not text:
        return ""
    lower = text.lower()
    q = query.lower()
    idx = lower.find(q) if q else -1
    if idx < 0:
        head = text[: context_chars * 2].rstrip()
        return head + ("…" if len(text) > len(head) else "")

    start = max(0, idx - context_chars)
    end = min(len(text), idx + len(query) + context_chars)
    prefix = "…" if start > 0 else ""
    suffix = "…" if end < len(text) else ""
    before = text[start:idx]
    match = text[idx : idx + len(query)]
    after = text[idx + len(query) : end]
    return f"{prefix}{before}{_MARK_OPEN}{match}{_MARK_CLOSE}{after}{suffix}"


def find_segment_matches(
    segments: Iterable[_Segment],
    query: str,
    *,
    max_snippets: int = 5,
    context_chars: int = _CONTEXT_CHARS,
) -> Tuple[List[dict], int]:
    """Find segments containing ``query``.

    Returns ``(snippets, total_hits)`` where ``snippets`` is an ordered list of
    ``{segmentId, speakerName, tStartSec, snippet}`` dicts (capped at
    ``max_snippets``, ordered by time) and ``total_hits`` is the total number of
    occurrences across *all* matching segments (used for scoring).
    """
    query = (query or "").strip()
    if not query:
        return [], 0

    matched: List[Tuple[float, dict]] = []
    total_hits = 0
    for seg in segments:
        hits = _count(seg.text or "", query)
        if hits == 0:
            continue
        total_hits += hits
        matched.append(
            (
                float(seg.t_start_sec),
                {
                    "segmentId": str(getattr(seg, "id", "")),
                    "speakerName": seg.speaker_name or "Unknown",
                    "tStartSec": float(seg.t_start_sec),
                    "snippet": make_snippet(seg.text, query, context_chars),
                },
            )
        )

    matched.sort(key=lambda m: m[0])
    snippets = [m[1] for m in matched[:max_snippets]]
    return snippets, total_hits


def score_meeting(
    *,
    transcript_hits: int,
    title: str,
    summary: str,
    query: str,
) -> int:
    """Relevance score: weighted title/summary hits + raw transcript occurrences."""
    score = transcript_hits
    if _count(title or "", query):
        score += _TITLE_WEIGHT
    if _count(summary or "", query):
        score += _SUMMARY_WEIGHT
    return score
