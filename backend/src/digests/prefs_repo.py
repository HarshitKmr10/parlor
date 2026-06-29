"""Persistence for per-workspace digest preferences."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

_COLS = (
    "id, workspace_id, enabled, frequency, hour_utc, day_of_week, channel, "
    "target, last_sent_at, created_at, updated_at"
)


class DigestPrefsRepo:
    def __init__(self, db) -> None:
        self._db = db

    async def get(self, workspace_id: str) -> Optional[Dict[str, Any]]:
        rows = await self._db.store.query_raw(
            f"SELECT {_COLS} FROM digest_preferences WHERE workspace_id = $1::uuid",
            workspace_id,
        )
        return rows[0] if rows else None

    async def upsert(
        self,
        *,
        workspace_id: str,
        enabled: bool,
        frequency: str,
        hour_utc: int,
        day_of_week: int,
        channel: str,
        target: Optional[str],
    ) -> Dict[str, Any]:
        rows = await self._db.store.query_raw(
            f"""
            INSERT INTO digest_preferences
              (workspace_id, enabled, frequency, hour_utc, day_of_week, channel, target)
            VALUES ($1::uuid, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (workspace_id) DO UPDATE SET
              enabled = EXCLUDED.enabled,
              frequency = EXCLUDED.frequency,
              hour_utc = EXCLUDED.hour_utc,
              day_of_week = EXCLUDED.day_of_week,
              channel = EXCLUDED.channel,
              target = EXCLUDED.target,
              updated_at = now()
            RETURNING {_COLS}
            """,
            workspace_id,
            enabled,
            frequency,
            hour_utc,
            day_of_week,
            channel,
            target,
        )
        return rows[0]

    async def list_enabled(self) -> List[Dict[str, Any]]:
        return await self._db.store.query_raw(
            f"SELECT {_COLS} FROM digest_preferences WHERE enabled = TRUE"
        )

    async def mark_sent(self, workspace_id: str) -> None:
        await self._db.store.query_raw(
            "UPDATE digest_preferences SET last_sent_at = now() "
            "WHERE workspace_id = $1::uuid",
            workspace_id,
        )
