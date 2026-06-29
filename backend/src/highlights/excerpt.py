"""Pure helper: snapshot the transcript text covering a clip's time range.

Stored on the highlight at creation so the reel still reads correctly even if
the transcript is later re-diarized or edited.
"""

from __future__ import annotations

from typing import Iterable, List, Protocol

_DEFAULT_MAX_CHARS = 1500


class _Segment(Protocol):
    speaker_name: str
    text: str
    t_start_sec: float
    t_end_sec: float


def _overlaps(seg: _Segment, start: float, end: float) -> bool:
    """True if the segment's [start,end] intersects the clip window.

    A zero-length clip (start == end, i.e. a point bookmark) matches any segment
    whose span contains that instant.
    """
    s, e = float(seg.t_start_sec), float(seg.t_end_sec)
    if start == end:
        return s <= start <= e
    return s < end and e > start


def extract_excerpt(
    segments: Iterable[_Segment],
    t_start_sec: float,
    t_end_sec: float,
    max_chars: int = _DEFAULT_MAX_CHARS,
) -> str:
    """Concatenate ``Speaker: text`` for segments overlapping the clip window.

    Returns an empty string when nothing overlaps. Truncates to ``max_chars``
    on a line boundary with an ellipsis so the snapshot stays bounded.
    """
    lines: List[str] = []
    for seg in segments:
        if not _overlaps(seg, t_start_sec, t_end_sec):
            continue
        text = (seg.text or "").strip()
        if not text:
            continue
        speaker = (seg.speaker_name or "Speaker").strip()
        lines.append(f"{speaker}: {text}")

    if not lines:
        return ""

    out = "\n".join(lines)
    if len(out) <= max_chars:
        return out

    # Truncate on the last line boundary that fits, then ellipsize.
    clipped: List[str] = []
    used = 0
    for line in lines:
        if used + len(line) + 1 > max_chars:
            break
        clipped.append(line)
        used += len(line) + 1
    if not clipped:  # a single oversized line
        return out[: max_chars - 1].rstrip() + "…"
    return "\n".join(clipped) + "\n…"
