"""Workspace digest / report API (workspace-scoped).

  GET /api/v1/reports/digest?from=&to=

Returns an activity rollup over the window (default: trailing 7 days): meeting
count, talk time, busiest day, action-item open/done totals + per assignee, and
the meeting list. Read-only aggregation — no LLM, no external calls.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query

from ...reports import ReportsRepo, resolve_range, summarize_meetings
from ...reports.aggregate import InvalidRange
from ..database.connection import DatabaseConnection
from .deps import AuthContext, get_current_context, get_db
from .errors import ApiError
from .schemas import (
    DigestActionItems,
    DigestAssignee,
    DigestMeeting,
    DigestReport,
)

router = APIRouter(prefix="/api/v1/reports", tags=["reports"])


async def _repo(db: DatabaseConnection = Depends(get_db)) -> ReportsRepo:
    return ReportsRepo(db)


@router.get(
    "/digest",
    response_model=DigestReport,
    summary="Get workspace activity digest",
    description=(
        "Returns an activity rollup for the given date range (default: "
        "trailing 7 days) — meeting count, talk time, busiest day, "
        "action-item open/done totals per assignee, and the meeting list. "
        "Read-only aggregation; no LLM or external calls."
    ),
)
async def get_digest(
    from_: Optional[str] = Query(None, alias="from"),
    to: Optional[str] = Query(None),
    ctx: AuthContext = Depends(get_current_context),
    repo: ReportsRepo = Depends(_repo),
) -> DigestReport:
    now = datetime.now(timezone.utc)
    try:
        start, end = resolve_range(from_, to, now=now)
    except InvalidRange as exc:
        raise ApiError(400, "invalid_range", str(exc))

    rows = await repo.meetings_in_range(ctx.workspace.id, start, end)
    summary = summarize_meetings(rows)
    rollup = await repo.action_item_rollup(ctx.workspace.id, start, end)

    return DigestReport(
        period_from=start,
        period_to=end,
        meeting_count=summary["meeting_count"],
        completed_count=summary["completed_count"],
        total_duration_sec=summary["total_duration_sec"],
        avg_duration_sec=summary["avg_duration_sec"],
        busiest_day=summary["busiest_day"],
        action_items=DigestActionItems(
            total=rollup["total"],
            open=rollup["open"],
            done=rollup["done"],
            by_assignee=[DigestAssignee(**a) for a in rollup["by_assignee"]],
        ),
        meetings=[
            DigestMeeting(
                id=r["id"],
                title=r.get("title"),
                status=r.get("status"),
                duration_sec=(
                    float(r["duration_sec"])
                    if r.get("duration_sec") is not None
                    else None
                ),
                created_at=r.get("created_at"),
            )
            for r in rows
        ],
        generated_at=now,
    )
