"""Workspace-scoped candidate fetch for cross-meeting keyword search.

The DB does the cheap narrowing (an ILIKE pre-filter over title/transcript/
summary, capped); the Python layer then parses transcripts and extracts ranked
snippets. This keeps the heavy text work off the DB while still using an index-
eligible scan to avoid loading every meeting in the workspace.
"""

from __future__ import annotations

from typing import Any, Dict, List


class SearchRepo:
    def __init__(self, db) -> None:
        self._db = db

    async def search_candidates(
        self, workspace_id: str, query: str, *, limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Return meetings whose title, transcript or summary contains ``query``.

        ``query`` is matched as a substring (case-insensitive). Special LIKE
        characters in the query are escaped so a user typing ``%`` searches for a
        literal percent sign rather than a wildcard.
        """
        from ..api.product.meetings_repo import _meeting_table  # noqa: PLC0415

        table = _meeting_table(self._db)
        pattern = "%" + _escape_like(query) + "%"
        rows = await self._db.store.query_raw(
            f"""
            SELECT id, title, transcript, insights
            FROM {table}
            WHERE workspace_id = $1::uuid
              AND (
                COALESCE(title, '') ILIKE $2 ESCAPE '\\'
                OR transcript::text ILIKE $2 ESCAPE '\\'
                OR COALESCE(insights::text, '') ILIKE $2 ESCAPE '\\'
              )
            ORDER BY created_at DESC
            LIMIT $3
            """,
            workspace_id,
            pattern,
            limit,
        )
        return list(rows or [])


def _escape_like(value: str) -> str:
    """Escape LIKE wildcards so the query is treated literally."""
    return (value or "").replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
