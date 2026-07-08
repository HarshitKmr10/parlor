"""Workspace-scoped range queries for digest reports."""

from __future__ import annotations

from typing import Any, Dict, List


class ReportsRepo:
    def __init__(self, db) -> None:
        self._db = db

    async def meetings_in_range(
        self, workspace_id: str, start: Any, end: Any, *, limit: int = 500
    ) -> List[Dict[str, Any]]:
        from ..api.product.meetings_repo import _meeting_table  # noqa: PLC0415

        table = _meeting_table(self._db)
        rows = await self._db.store.query_raw(
            f"""
            SELECT id, title, status, created_at, bot_join_time, bot_leave_time,
                   EXTRACT(EPOCH FROM (bot_leave_time - bot_join_time)) AS duration_sec
            FROM {table}
            WHERE workspace_id = $1::uuid
              AND deleted_at IS NULL
              AND created_at >= $2 AND created_at < $3
            ORDER BY created_at DESC
            LIMIT $4
            """,
            workspace_id,
            start,
            end,
            limit,
        )
        out: List[Dict[str, Any]] = []
        for r in rows or []:
            row = dict(r)
            if row.get("id") is not None:
                row["id"] = str(row["id"])
            out.append(row)
        return out

    async def action_item_rollup(
        self, workspace_id: str, start: Any, end: Any
    ) -> Dict[str, Any]:
        """Totals + per-assignee open/done for items created in the window.

        Excludes action items belonging to a soft-deleted meeting -- otherwise
        the digest would keep surfacing assignee/done counts sourced from a
        meeting that's supposed to be hidden pending its retention tombstone.
        """
        not_from_deleted_meeting = (
            "NOT EXISTS ("
            "SELECT 1 FROM meeting_joiner m "
            "WHERE m.id = action_items.meeting_id AND m.deleted_at IS NOT NULL"
            ")"
        )
        totals = await self._db.store.query_raw(
            f"""
            SELECT COUNT(*) AS total,
                   COUNT(*) FILTER (WHERE NOT done) AS open,
                   COUNT(*) FILTER (WHERE done) AS done
            FROM action_items
            WHERE workspace_id = $1::uuid
              AND created_at >= $2 AND created_at < $3
              AND {not_from_deleted_meeting}
            """,
            workspace_id,
            start,
            end,
        )
        by_assignee = await self._db.store.query_raw(
            f"""
            SELECT COALESCE(assignee, '(unassigned)') AS assignee,
                   COUNT(*) FILTER (WHERE NOT done) AS open,
                   COUNT(*) FILTER (WHERE done) AS done
            FROM action_items
            WHERE workspace_id = $1::uuid
              AND created_at >= $2 AND created_at < $3
              AND {not_from_deleted_meeting}
            GROUP BY COALESCE(assignee, '(unassigned)')
            ORDER BY open DESC, done DESC
            LIMIT 25
            """,
            workspace_id,
            start,
            end,
        )
        t = (totals or [{}])[0]
        return {
            "total": int(t.get("total") or 0),
            "open": int(t.get("open") or 0),
            "done": int(t.get("done") or 0),
            "by_assignee": [
                {
                    "assignee": r["assignee"],
                    "open": int(r["open"]),
                    "done": int(r["done"]),
                }
                for r in (by_assignee or [])
            ],
        }
