"""Webhook event catalog, subscription matching, retry schedule, secrets.

All pure helpers — no I/O — so they're trivially unit-testable.
"""

from __future__ import annotations

import secrets
from typing import Sequence

# The catalog of events a workspace can subscribe to. Keep names stable: they
# are part of the public contract consumers filter on.
EVENT_TYPES: tuple[str, ...] = (
    "meeting.started",
    "meeting.completed",
    "transcript.ready",
    "summary.ready",
    "highlight.created",
    "comment.created",
)

# Exponential backoff between delivery attempts (seconds). attempt N (1-based)
# uses index N-1; the last value repeats for any further attempts. Caps ~6h.
_BACKOFF_SCHEDULE: tuple[int, ...] = (60, 300, 1800, 7200, 21600)

_SECRET_PREFIX = "whsec_"


def generate_secret() -> str:
    """A signing secret for a new endpoint (``whsec_`` + 32 url-safe bytes)."""
    return _SECRET_PREFIX + secrets.token_urlsafe(32)


def event_matches(event_type: str, subscribed: Sequence[str] | None) -> bool:
    """True if an endpoint subscribed to ``subscribed`` wants ``event_type``.

    An empty/None allow-list means "all events" (the common default).
    """
    if not subscribed:
        return True
    return event_type in set(subscribed)


def is_known_event(event_type: str) -> bool:
    return event_type in EVENT_TYPES


def backoff_seconds(attempt: int) -> int:
    """Delay before ``attempt`` (1-based). attempt<=1 → first retry delay."""
    idx = max(0, attempt - 1)
    if idx >= len(_BACKOFF_SCHEDULE):
        return _BACKOFF_SCHEDULE[-1]
    return _BACKOFF_SCHEDULE[idx]
