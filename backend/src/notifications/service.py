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


async def _is_user_quiet(db, workspace_id: str, user_id: str) -> bool:
    """Whether ``user_id`` is currently inside their quiet-hours window.

    Fail-open: any lookup error returns False (i.e. send), so a quiet-hours
    problem never silently swallows a notification. Uses the UTC hour — see
    ``is_quiet_now`` for the (no per-user timezone) simplification.
    """
    try:
        from ..quiet_hours import QuietHoursRepo, is_quiet_now  # noqa: PLC0415

        prefs = await QuietHoursRepo(db).get(workspace_id, user_id)
        return is_quiet_now(prefs)
    except Exception as exc:  # noqa: BLE001 — fail-open toward sending
        logger.warning("quiet-hours check failed for user %s: %s", user_id, exc)
        return False


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
    respect_quiet_hours: bool = False,
) -> int:
    """Fan a notification out to multiple users. Skips the actor themselves.

    When ``respect_quiet_hours`` is set, a recipient currently inside their
    quiet-hours window is skipped (do-not-notify). The check is fail-open: any
    error loading quiet-hours prefs falls back to sending.

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
        if respect_quiet_hours and await _is_user_quiet(db, workspace_id, uid):
            logger.info("notify.suppressed_quiet_hours user=%s type=%s", uid, type)
            continue
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
