"""Pure usage aggregation over meeting rows."""

from __future__ import annotations

from typing import Any, Dict, List, Sequence


def summarize_usage(meetings: Sequence[Dict[str, Any]]) -> Dict[str, Any]:
    """Aggregate meetings -> {meetingCount, completedCount, totalMinutes,
    perCreator[]}. Rows carry id, status, duration_sec, created_by.
    """
    total_sec = 0.0
    completed = 0
    per_creator: Dict[str, Dict[str, Any]] = {}
    for m in meetings:
        dur = float(m.get("duration_sec") or 0)
        total_sec += dur
        if m.get("status") == "completed":
            completed += 1
        creator = str(m.get("created_by") or "unknown")
        bucket = per_creator.setdefault(
            creator, {"creator": creator, "meetings": 0, "minutes": 0.0}
        )
        bucket["meetings"] += 1
        bucket["minutes"] += dur / 60.0

    per_creator_list: List[Dict[str, Any]] = [
        {"creator": v["creator"], "meetings": v["meetings"], "minutes": round(v["minutes"], 1)}
        for v in per_creator.values()
    ]
    per_creator_list.sort(key=lambda x: x["meetings"], reverse=True)

    return {
        "meeting_count": len(meetings),
        "completed_count": completed,
        "total_minutes": round(total_sec / 60.0, 1),
        "active_members": len(per_creator),
        "per_creator": per_creator_list,
    }
