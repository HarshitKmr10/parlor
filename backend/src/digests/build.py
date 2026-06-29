"""Assemble a digest dict for a workspace over the trailing window.

Reuses the same aggregation as the on-demand GET /reports/digest so the
scheduled email and the in-app report never diverge.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict

from ..reports import ReportsRepo, resolve_range, summarize_meetings


async def build_digest(repo: ReportsRepo, workspace_id: str, now: datetime) -> Dict[str, Any]:
    start, end = resolve_range(None, None, now=now)
    rows = await repo.meetings_in_range(workspace_id, start, end)
    summary = summarize_meetings(rows)
    rollup = await repo.action_item_rollup(workspace_id, start, end)
    return {
        "period_from": start,
        "period_to": end,
        "meeting_count": summary["meeting_count"],
        "completed_count": summary["completed_count"],
        "total_duration_sec": summary["total_duration_sec"],
        "avg_duration_sec": summary["avg_duration_sec"],
        "busiest_day": summary["busiest_day"],
        "action_items": rollup,
        "meetings": rows,
    }
