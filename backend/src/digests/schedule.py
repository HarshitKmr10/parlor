"""Pure scheduling predicate for digest delivery — no I/O, fully unit-testable."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Mapping, Optional


def is_due(pref: Mapping[str, Any], now: datetime, last_sent_at: Optional[datetime]) -> bool:
    """Decide whether a workspace's digest should be sent at ``now``.

    Rules:
      - disabled prefs are never due
      - never send before the configured hour (UTC)
      - never send twice on the same calendar day
      - weekly digests only fire on the configured weekday (0=Mon..6=Sun)
    """
    if not pref.get("enabled"):
        return False
    if not pref.get("target"):
        return False
    hour_utc = int(pref.get("hour_utc", 13))
    if now.hour < hour_utc:
        return False
    # Already sent today?
    if last_sent_at is not None and last_sent_at.date() >= now.date():
        return False
    frequency = str(pref.get("frequency", "weekly"))
    if frequency == "daily":
        return True
    if frequency == "weekly":
        return now.weekday() == int(pref.get("day_of_week", 0))
    return False
