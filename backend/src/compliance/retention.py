"""Pure retention logic — no I/O, unit-testable."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, List, Mapping, Optional, Sequence


def cutoff_for(retention_days: Optional[int], now: datetime) -> Optional[datetime]:
    """The timestamp before which data is expired, or None if kept forever."""
    if retention_days is None or retention_days <= 0:
        return None
    return now - timedelta(days=retention_days)


def select_expired(
    meetings: Sequence[Mapping[str, Any]],
    *,
    retention_days: Optional[int],
    legal_hold: bool,
    now: datetime,
) -> List[str]:
    """Return ids of meetings past the retention window (soft-delete candidates).

    Legal hold pauses ALL deletion. `meetings` rows must carry `id` + a
    `created_at` datetime. Callers should pass only not-yet-soft-deleted rows
    (`deleted_at IS NULL`) — see `RetentionRepo.meeting_dates`.
    """
    if legal_hold:
        return []
    cutoff = cutoff_for(retention_days, now)
    if cutoff is None:
        return []
    expired: List[str] = []
    for m in meetings:
        created = m.get("created_at")
        if isinstance(created, datetime) and created < cutoff:
            expired.append(str(m["id"]))
    return expired


def select_tombstoned(
    meetings: Sequence[Mapping[str, Any]],
    *,
    tombstone_days: int,
    legal_hold: bool,
    now: datetime,
) -> List[str]:
    """Return ids of soft-deleted meetings past the tombstone window (hard-delete
    candidates).

    Legal hold pauses ALL deletion, including hard-deleting an already
    soft-deleted row. `meetings` rows must carry `id` + a `deleted_at`
    datetime. Callers should pass only already soft-deleted rows
    (`deleted_at IS NOT NULL`) — see `RetentionRepo.tombstoned_meetings`.
    """
    if legal_hold:
        return []
    if tombstone_days <= 0:
        cutoff = now
    else:
        cutoff = now - timedelta(days=tombstone_days)
    ready: List[str] = []
    for m in meetings:
        deleted_at = m.get("deleted_at")
        if isinstance(deleted_at, datetime) and deleted_at < cutoff:
            ready.append(str(m["id"]))
    return ready
