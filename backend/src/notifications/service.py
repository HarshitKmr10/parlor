"""Reusable notification emit helper.

`notify` is best-effort: a failure to write a notification must never break the
primary action (posting a comment, completing a meeting). Callers pass a db
handle so this stays decoupled from any request context.
"""

from __future__ import annotations

import logging
from typing import Iterable, Optional

from .repo import NotificationsRepo

logger = logging.getLogger("notifications")


async def notify(
    db,
    *,
    workspace_id: str,
    user_ids: Iterable[str],
    type: str,
    title: str,
    body: Optional[str] = None,
    link: Optional[str] = None,
    meeting_id: Optional[str] = None,
    actor_id: Optional[str] = None,
) -> int:
    """Fan a notification out to multiple users. Skips the actor themselves.

    Returns the number of rows written. Never raises — logs and returns 0 on
    failure so the calling action is unaffected.
    """
    repo = NotificationsRepo(db)
    written = 0
    seen: set[str] = set()
    for uid in user_ids:
        if not uid or uid == actor_id or uid in seen:
            continue
        seen.add(uid)
        try:
            await repo.create(
                workspace_id=workspace_id,
                user_id=uid,
                type=type,
                title=title,
                body=body,
                link=link,
                meeting_id=meeting_id,
                actor_id=actor_id,
            )
            written += 1
        except Exception as exc:  # noqa: BLE001 — best-effort
            logger.warning("notify failed for user %s: %s", uid, exc)
    return written
