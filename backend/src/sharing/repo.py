"""Persistence for meeting share links.

Owner-facing reads/writes are workspace-scoped. The public lookup is by token
only (the token is the capability) and deliberately returns ``workspace_id`` so
the public handler can load the meeting without trusting any caller-supplied
identifier.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

_COLS = (
    "id, meeting_id, workspace_id, created_by, token, include_transcript, "
    "include_highlights, include_analytics, revoked, expires_at, view_count, "
    "last_viewed_at, created_at, updated_at"
)


class SharesRepo:
    def __init__(self, db) -> None:
        self._db = db

    async def upsert(
        self,
        *,
        meeting_id: str,
        workspace_id: str,
        created_by: Optional[str],
        token: str,
        include_transcript: bool,
        include_highlights: bool,
        include_analytics: bool,
        expires_at: Optional[Any],
    ) -> Dict[str, Any]:
        """Create the meeting's share, or rotate the token + reset flags if one
        already exists (re-sharing). Un-revokes a previously revoked link."""
        rows = await self._db.store.query_raw(
            f"""
            INSERT INTO meeting_shares
              (meeting_id, workspace_id, created_by, token, include_transcript,
               include_highlights, include_analytics, expires_at)
            VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8)
            ON CONFLICT (meeting_id) DO UPDATE SET
              token = EXCLUDED.token,
              include_transcript = EXCLUDED.include_transcript,
              include_highlights = EXCLUDED.include_highlights,
              include_analytics = EXCLUDED.include_analytics,
              expires_at = EXCLUDED.expires_at,
              revoked = FALSE,
              updated_at = NOW()
            RETURNING {_COLS}
            """,
            meeting_id,
            workspace_id,
            created_by,
            token,
            include_transcript,
            include_highlights,
            include_analytics,
            expires_at,
        )
        return self._normalize(rows[0])

    async def get_for_meeting(
        self, meeting_id: str, workspace_id: str
    ) -> Optional[Dict[str, Any]]:
        rows = await self._db.store.query_raw(
            f"SELECT {_COLS} FROM meeting_shares "
            f"WHERE meeting_id = $1::uuid AND workspace_id = $2::uuid",
            meeting_id,
            workspace_id,
        )
        return self._normalize(rows[0]) if rows else None

    async def get_by_token(self, token: str) -> Optional[Dict[str, Any]]:
        rows = await self._db.store.query_raw(
            f"SELECT {_COLS} FROM meeting_shares WHERE token = $1",
            token,
        )
        return self._normalize(rows[0]) if rows else None

    async def revoke(self, meeting_id: str, workspace_id: str) -> bool:
        rows = await self._db.store.query_raw(
            "UPDATE meeting_shares SET revoked = TRUE, updated_at = NOW() "
            "WHERE meeting_id = $1::uuid AND workspace_id = $2::uuid "
            "RETURNING id",
            meeting_id,
            workspace_id,
        )
        return bool(rows)

    async def record_view(self, token: str) -> None:
        """Best-effort view counter bump (never gates the public response)."""
        await self._db.store.query_raw(
            "UPDATE meeting_shares "
            "SET view_count = view_count + 1, last_viewed_at = NOW() "
            "WHERE token = $1",
            token,
        )

    @staticmethod
    def _normalize(row: Dict[str, Any]) -> Dict[str, Any]:
        out = dict(row)
        for key in ("id", "meeting_id", "workspace_id", "created_by"):
            if out.get(key) is not None:
                out[key] = str(out[key])
        return out
