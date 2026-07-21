"""Persistence for per-user notification quiet hours (do-not-notify window)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional

_COLS = "workspace_id, user_id, enabled, start_hour, end_hour, updated_at"

DEFAULTS: Dict[str, Any] = {
    "enabled": False,
    "start_hour": 20,
    "end_hour": 8,
}


def is_quiet(hour: int, prefs: Dict[str, Any]) -> bool:
    """Return True if ``hour`` (0..23) falls inside the quiet window.

    Handles a window that wraps past midnight (start_hour > end_hour), e.g.
    start=20, end=8 covers 20,21,..,23,0,1,..,7. The window is half-open on the
    end (``end_hour`` itself is no longer quiet). When disabled, never quiet.
    """
    if not prefs.get("enabled"):
        return False
    start = int(prefs.get("start_hour", DEFAULTS["start_hour"]))
    end = int(prefs.get("end_hour", DEFAULTS["end_hour"]))
    if start == end:
        return False
    if start < end:
        return start <= hour < end
    # Wraps midnight.
    return hour >= start or hour < end


def is_quiet_now(prefs: Dict[str, Any], now: Optional[datetime] = None) -> bool:
    """Convenience decision helper: is ``now`` inside the user's quiet window?

    Simplification: we have no per-user timezone, so the current **UTC** hour is
    used. Once a tz is tracked per user, convert before calling ``is_quiet``.
    """
    now = now or datetime.now(timezone.utc)
    return is_quiet(now.hour, prefs)


class QuietHoursRepo:
    def __init__(self, db) -> None:
        self._db = db

    async def get(self, workspace_id: str, user_id: str) -> Dict[str, Any]:
        rows = await self._db.store.query_raw(
            f"""
            SELECT {_COLS} FROM notification_quiet_hours
            WHERE workspace_id = $1::uuid AND user_id = $2::uuid
            """,
            workspace_id,
            user_id,
        )
        return rows[0] if rows else {
            **DEFAULTS,
            "workspace_id": workspace_id,
            "user_id": user_id,
        }

    async def upsert(
        self,
        *,
        workspace_id: str,
        user_id: str,
        enabled: bool,
        start_hour: int,
        end_hour: int,
    ) -> Dict[str, Any]:
        rows = await self._db.store.query_raw(
            f"""
            INSERT INTO notification_quiet_hours
              (workspace_id, user_id, enabled, start_hour, end_hour)
            VALUES ($1::uuid, $2::uuid, $3, $4, $5)
            ON CONFLICT (workspace_id, user_id) DO UPDATE SET
              enabled = EXCLUDED.enabled,
              start_hour = EXCLUDED.start_hour,
              end_hour = EXCLUDED.end_hour,
              updated_at = now()
            RETURNING {_COLS}
            """,
            workspace_id,
            user_id,
            enabled,
            start_hour,
            end_hour,
        )
        return rows[0]
