"""Persistence for per-workspace sharing defaults (expiry + passcode)."""

from __future__ import annotations

from typing import Any, Dict

_COLS = (
    "workspace_id, default_expiry_hours, require_passcode, "
    "default_passcode, created_at, updated_at"
)

DEFAULTS: Dict[str, Any] = {
    "default_expiry_hours": 0,
    "require_passcode": False,
    "default_passcode": "",
}


class ShareSettingsRepo:
    def __init__(self, db) -> None:
        self._db = db

    async def get(self, workspace_id: str) -> Dict[str, Any]:
        rows = await self._db.store.query_raw(
            f"SELECT {_COLS} FROM workspace_share_settings WHERE workspace_id = $1::uuid",
            workspace_id,
        )
        return rows[0] if rows else {**DEFAULTS, "workspace_id": workspace_id}

    async def upsert(
        self,
        *,
        workspace_id: str,
        default_expiry_hours: int,
        require_passcode: bool,
        default_passcode: str = "",
    ) -> Dict[str, Any]:
        rows = await self._db.store.query_raw(
            f"""
            INSERT INTO workspace_share_settings
              (workspace_id, default_expiry_hours, require_passcode, default_passcode)
            VALUES ($1::uuid, $2, $3, $4)
            ON CONFLICT (workspace_id) DO UPDATE SET
              default_expiry_hours = EXCLUDED.default_expiry_hours,
              require_passcode = EXCLUDED.require_passcode,
              default_passcode = EXCLUDED.default_passcode,
              updated_at = now()
            RETURNING {_COLS}
            """,
            workspace_id,
            default_expiry_hours,
            require_passcode,
            default_passcode,
        )
        return rows[0]
