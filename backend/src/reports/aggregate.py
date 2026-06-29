"""Pure helpers for digest reports: window resolution + meeting aggregation."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Iterable, List, Optional, Tuple

_DEFAULT_WINDOW_DAYS = 7
_MAX_WINDOW_DAYS = 366


class InvalidRange(ValueError):
    """Raised for a malformed or nonsensical report window."""


def _parse_iso(value: str) -> datetime:
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


def resolve_range(
    from_str: Optional[str], to_str: Optional[str], *, now: datetime
) -> Tuple[datetime, datetime]:
    """Resolve the report window, defaulting to the trailing 7 days.

    Raises :class:`InvalidRange` on bad input or a window over a year wide.
    """
    try:
        end = _parse_iso(to_str) if to_str else now
        start = (
            _parse_iso(from_str)
            if from_str
            else end - timedelta(days=_DEFAULT_WINDOW_DAYS)
        )
    except ValueError as exc:
        raise InvalidRange("Dates must be ISO-8601") from exc

    if start >= end:
        raise InvalidRange("'from' must be before 'to'")
    if (end - start) > timedelta(days=_MAX_WINDOW_DAYS):
        raise InvalidRange("Report window may not exceed 366 days")
    return start, end


def _busiest_day(dates: Iterable[datetime]) -> Optional[str]:
    counts: Dict[str, int] = {}
    for d in dates:
        key = d.date().isoformat()
        counts[key] = counts.get(key, 0) + 1
    if not counts:
        return None
    return max(counts, key=lambda k: counts[k])


def summarize_meetings(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Aggregate meeting rows into digest counts/durations.

    Each row may carry ``duration_sec`` (float|None), ``status`` and
    ``created_at`` (datetime). Tolerant of missing fields.
    """
    count = len(rows)
    durations = [
        float(r["duration_sec"])
        for r in rows
        if r.get("duration_sec") is not None and float(r["duration_sec"]) >= 0
    ]
    total = round(sum(durations), 1)
    completed = sum(1 for r in rows if r.get("status") == "completed")
    created = [
        r["created_at"] for r in rows if isinstance(r.get("created_at"), datetime)
    ]
    return {
        "meeting_count": count,
        "completed_count": completed,
        "total_duration_sec": total,
        "avg_duration_sec": round(total / len(durations), 1) if durations else 0.0,
        "busiest_day": _busiest_day(created),
    }
