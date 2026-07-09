"""Lifetime per-workspace meeting count — the only query this module needs.

No new tracking table: the existing ``meeting_joiner`` row set is already the
source of truth for "how many meetings has this workspace ever created."
Counts regardless of ``deleted_at`` — soft-deleted meetings still occupy
storage until the retention sweep hard-deletes them, and counting only
non-deleted rows would let an account bypass the cap by deleting and
recreating meetings indefinitely.
"""

from __future__ import annotations

from ..db.python.schema import qualified_name

_MEETING_TABLE_CACHE: str | None = None


def _meeting_table(db) -> str:
    global _MEETING_TABLE_CACHE
    if _MEETING_TABLE_CACHE is not None:
        return _MEETING_TABLE_CACHE
    driver = getattr(db, "_driver", "pg")
    _MEETING_TABLE_CACHE = (
        qualified_name("meeting_joiner") if driver == "pg" else "meeting_joiner"
    )
    return _MEETING_TABLE_CACHE


async def count_workspace_meetings(db, workspace_id: str) -> int:
    table = _meeting_table(db)
    rows = await db.store.query_raw(
        f"SELECT COUNT(*) AS n FROM {table} WHERE workspace_id = $1::uuid",
        workspace_id,
    )
    if not rows:
        return 0
    return int(rows[0].get("n") or 0)
