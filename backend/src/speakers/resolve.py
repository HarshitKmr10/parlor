"""Pure speaker-label resolution — no I/O, unit-testable.

`build_alias_map` turns a list of profile rows into a lowercased alias→name
lookup; `apply_speaker_profiles` renames transcript segments' speaker_name in
place of a copy (never mutates inputs).
"""

from __future__ import annotations

from typing import Any, Dict, List, Mapping, Sequence


def build_alias_map(profiles: Sequence[Mapping[str, Any]]) -> Dict[str, str]:
    """alias (lowercased) -> display_name. Later profiles win on conflict."""
    out: Dict[str, str] = {}
    for p in profiles:
        name = str(p.get("display_name") or "").strip()
        if not name:
            continue
        for alias in p.get("aliases") or []:
            key = str(alias).strip().lower()
            if key:
                out[key] = name
        # The display name itself also resolves to itself.
        out[name.lower()] = name
    return out


def apply_speaker_profiles(
    segments: Sequence[Mapping[str, Any]], alias_map: Mapping[str, str]
) -> List[Dict[str, Any]]:
    """Return new segment dicts with speaker names resolved via the alias map."""
    if not alias_map:
        return [dict(s) for s in segments]
    resolved: List[Dict[str, Any]] = []
    for s in segments:
        seg = dict(s)
        name = str(seg.get("speakerName") or seg.get("speaker_name") or "")
        mapped = alias_map.get(name.lower())
        if mapped:
            if "speakerName" in seg:
                seg["speakerName"] = mapped
            if "speaker_name" in seg:
                seg["speaker_name"] = mapped
        resolved.append(seg)
    return resolved
