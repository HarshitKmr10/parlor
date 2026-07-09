"""Enforcement point for the hosted-instance meeting quota.

Call ``enforce_meeting_quota`` as the very first thing in a meeting-creation
route, before any other work (bot dispatch, row creation, etc.). When
``HOSTED_QUOTA_ENABLED`` is unset/false this is a single cheap env-var read
and returns immediately — no DB round trip, so self-hosters pay zero cost for
a feature they never opted into.
"""

from __future__ import annotations

from ..api.product.errors import ApiError
from .config import get_hosted_quota_config
from .repo import count_workspace_meetings


async def enforce_meeting_quota(db, workspace_id: str) -> None:
    config = get_hosted_quota_config()
    if not config.enabled:
        return

    existing = await count_workspace_meetings(db, workspace_id)
    if existing >= config.max_total_meetings:
        raise ApiError(
            429,
            "quota_exceeded",
            f"This hosted instance limits each workspace to "
            f"{config.max_total_meetings} meetings — self-host Parlor for "
            "unlimited use.",
            details={
                "limit": config.max_total_meetings,
                "current": existing,
            },
        )
