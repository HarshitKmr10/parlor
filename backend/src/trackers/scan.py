"""Pure keyword-tracker matcher over transcript segments.

For each enabled tracker, find segments whose text contains any keyword
(case-insensitive, word-ish boundary) and emit a hit per (tracker, segment,
keyword). No I/O — trivially unit-testable.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Mapping, Sequence


def _seg_field(seg: Any, *names: str, default=""):
    if isinstance(seg, Mapping):
        for n in names:
            if n in seg and seg[n] is not None:
                return seg[n]
        return default
    for n in names:
        v = getattr(seg, n, None)
        if v is not None:
            return v
    return default


def scan_segments(
    trackers: Sequence[Mapping[str, Any]], segments: Sequence[Any]
) -> List[Dict[str, Any]]:
    """Return hits: {tracker_id, matched_keyword, segment_id, t_start_sec, snippet}."""
    hits: List[Dict[str, Any]] = []
    for tracker in trackers:
        if not tracker.get("enabled", True):
            continue
        keywords = [str(k).strip() for k in (tracker.get("keywords") or []) if str(k).strip()]
        if not keywords:
            continue
        patterns = [(kw, re.compile(re.escape(kw), re.IGNORECASE)) for kw in keywords]
        for seg in segments:
            text = str(_seg_field(seg, "text", default=""))
            if not text:
                continue
            for kw, pat in patterns:
                if pat.search(text):
                    hits.append(
                        {
                            "tracker_id": str(tracker["id"]),
                            "matched_keyword": kw,
                            "segment_id": str(_seg_field(seg, "id", "segment_id", default="")),
                            "t_start_sec": float(
                                _seg_field(seg, "t_start_sec", "tStartSec", "startTime", default=0) or 0
                            ),
                            "snippet": text[:300],
                        }
                    )
                    break  # one hit per segment per tracker is enough
    return hits
