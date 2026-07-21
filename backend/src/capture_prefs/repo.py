"""Persistence for per-workspace auto-join preferences (calendar capture)."""

from __future__ import annotations

from typing import Any, Dict

_COLS = (
    "workspace_id, auto_join_enabled, join_lead_minutes, "
    "join_zoom, join_meet, join_teams, created_at, updated_at"
)

DEFAULTS: Dict[str, Any] = {
    "auto_join_enabled": True,
    "join_lead_minutes": 2,
    "join_zoom": True,
    "join_meet": True,
    "join_teams": True,
}


class CapturePrefsRepo:
    def __init__(self, db) -> None:
        self._db = db

    async def get(self, workspace_id: str) -> Dict[str, Any]:
        rows = await self._db.store.query_raw(
            f"SELECT {_COLS} FROM workspace_capture_prefs WHERE workspace_id = $1::uuid",
            workspace_id,
        )
        return rows[0] if rows else {**DEFAULTS, "workspace_id": workspace_id}

    async def upsert(
        self,
        *,
        workspace_id: str,
        auto_join_enabled: bool,
        join_lead_minutes: int,
        join_zoom: bool,
        join_meet: bool,
        join_teams: bool,
    ) -> Dict[str, Any]:
        rows = await self._db.store.query_raw(
            f"""
            INSERT INTO workspace_capture_prefs
              (workspace_id, auto_join_enabled, join_lead_minutes,
               join_zoom, join_meet, join_teams)
            VALUES ($1::uuid, $2, $3, $4, $5, $6)
            ON CONFLICT (workspace_id) DO UPDATE SET
              auto_join_enabled = EXCLUDED.auto_join_enabled,
              join_lead_minutes = EXCLUDED.join_lead_minutes,
              join_zoom = EXCLUDED.join_zoom,
              join_meet = EXCLUDED.join_meet,
              join_teams = EXCLUDED.join_teams,
              updated_at = now()
            RETURNING {_COLS}
            """,
            workspace_id,
            auto_join_enabled,
            join_lead_minutes,
            join_zoom,
            join_meet,
            join_teams,
        )
        return rows[0]
