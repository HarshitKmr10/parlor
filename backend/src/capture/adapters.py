"""Pure transcript-format adapters.

Each returns a list of internal segment dicts:
    {id, speakerName, speakerId, text, tStartSec, tEndSec}
No I/O — unit-testable. The capture route maps these onto TranscriptSegment and
reuses the existing append pipeline.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Mapping, Sequence


def _seg(i: int, speaker: str, text: str, start: float, end: float) -> Dict[str, Any]:
    return {
        "id": f"seg-{i}",
        "speakerName": speaker or "Unknown",
        "speakerId": None,
        "text": text.strip(),
        "tStartSec": float(start),
        "tEndSec": float(end),
    }


def normalize_zoom(payload: Mapping[str, Any]) -> List[Dict[str, Any]]:
    """Zoom cloud-recording transcript: a list of entries with start/end/speaker/text.

    Accepts ``{"transcript": [...]}`` or a bare list under common keys.
    """
    entries: Sequence[Any] = (
        payload.get("transcript")
        or payload.get("entries")
        or payload.get("segments")
        or []
    )
    out: List[Dict[str, Any]] = []
    for i, e in enumerate(entries):
        if not isinstance(e, Mapping):
            continue
        start = e.get("start_time") or e.get("ts") or e.get("startTime") or 0
        end = e.get("end_time") or e.get("endTime") or start
        out.append(
            _seg(
                i,
                str(e.get("speaker") or e.get("speaker_name") or "Unknown"),
                str(e.get("text") or ""),
                _to_sec(start),
                _to_sec(end),
            )
        )
    return [s for s in out if s["text"]]


def normalize_teams(payload: Mapping[str, Any]) -> List[Dict[str, Any]]:
    """MS Teams transcript: ``{"entries": [{speakerDisplayName, text, startOffset}]}``.

    Offsets may be ISO-8601 durations (PT1M3S) or seconds.
    """
    entries: Sequence[Any] = payload.get("entries") or payload.get("transcript") or []
    out: List[Dict[str, Any]] = []
    for i, e in enumerate(entries):
        if not isinstance(e, Mapping):
            continue
        start = _to_sec(e.get("startOffset") or e.get("start") or 0)
        end = _to_sec(e.get("endOffset") or e.get("end") or start)
        out.append(
            _seg(
                i,
                str(e.get("speakerDisplayName") or e.get("speaker") or "Unknown"),
                str(e.get("text") or ""),
                start,
                end,
            )
        )
    return [s for s in out if s["text"]]


_VTT_TIME = re.compile(r"(\d{2}):(\d{2}):(\d{2})[.,](\d{3})")
_VTT_CUE = re.compile(
    r"(?:<v\s+([^>]+)>)?\s*(.*)", re.S
)


def normalize_vtt(text: str) -> List[Dict[str, Any]]:
    """Parse WebVTT (the common export for Zoom/Teams/Meet captions)."""
    blocks = re.split(r"\n\s*\n", text.strip())
    out: List[Dict[str, Any]] = []
    i = 0
    for block in blocks:
        if "-->" not in block:
            continue
        lines = [ln for ln in block.splitlines() if ln.strip()]
        time_line = next((ln for ln in lines if "-->" in ln), None)
        if not time_line:
            continue
        times = _VTT_TIME.findall(time_line)
        if len(times) < 2:
            continue
        start, end = _vtt_to_sec(times[0]), _vtt_to_sec(times[1])
        body_lines = lines[lines.index(time_line) + 1 :]
        body = " ".join(body_lines).strip()
        speaker = "Unknown"
        m = re.match(r"<v\s+([^>]+)>(.*)", body)
        if m:
            speaker, body = m.group(1).strip(), m.group(2).strip()
        body = re.sub(r"</?v[^>]*>", "", body).strip()
        if body:
            out.append(_seg(i, speaker, body, start, end))
            i += 1
    return out


def normalize(provider: str, payload: Any) -> List[Dict[str, Any]]:
    p = (provider or "").lower()
    if p == "zoom":
        return normalize_zoom(payload if isinstance(payload, Mapping) else {})
    if p in ("teams", "msteams"):
        return normalize_teams(payload if isinstance(payload, Mapping) else {})
    if p == "vtt":
        return normalize_vtt(payload if isinstance(payload, str) else str(payload))
    raise ValueError(f"Unsupported capture provider: {provider}")


def _to_sec(value: Any) -> float:
    """Accept seconds (number/str) or an ISO-8601 duration (PT1M3.5S)."""
    if isinstance(value, (int, float)):
        return float(value)
    s = str(value).strip()
    if not s:
        return 0.0
    if s.startswith("PT"):
        m = re.fullmatch(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?", s)
        if m:
            h, mn, sec = m.groups()
            return (int(h or 0) * 3600) + (int(mn or 0) * 60) + float(sec or 0)
    try:
        return float(s)
    except ValueError:
        return 0.0


def _vtt_to_sec(parts: tuple) -> float:
    h, m, s, ms = parts
    return int(h) * 3600 + int(m) * 60 + int(s) + int(ms) / 1000.0
