"""Workspace usage analytics API (admin).

  GET /api/v1/usage  -> meetings, minutes, active members, per-creator breakdown
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from ...usage import LlmUsageRepo, summarize_usage
from ..database.connection import DatabaseConnection
from .deps import AuthContext, get_db
from .rbac import require_role
from .schemas import LlmUsageBreakdown, LlmUsageDailyPoint, UsageSummary

router = APIRouter(prefix="/api/v1", tags=["usage"])


@router.get(
    "/usage",
    response_model=UsageSummary,
    summary="Get workspace usage summary",
    description=(
        "Returns meeting/minute counts and LLM token usage and estimated cost "
        "for the current workspace, including a per-provider/model breakdown "
        "and a daily trend. Requires the admin role."
    ),
)
async def get_usage(
    ctx: AuthContext = Depends(require_role("admin")),
    db: DatabaseConnection = Depends(get_db),
) -> UsageSummary:
    rows = await db.store.query_raw(
        "SELECT id, status, "
        "EXTRACT(EPOCH FROM (bot_leave_time - bot_join_time)) AS duration_sec "
        "FROM meeting_joiner WHERE workspace_id = $1::uuid AND deleted_at IS NULL",
        ctx.workspace.id,
    )
    summary = summarize_usage(rows)

    llm_repo = LlmUsageRepo(db)
    llm_totals = await llm_repo.get_totals(ctx.workspace.id)
    llm_breakdown_rows = await llm_repo.get_breakdown_by_provider_model(ctx.workspace.id)
    llm_daily_rows = await llm_repo.get_daily_trend(ctx.workspace.id)

    # Per-creator attribution isn't tracked on the meeting row yet; report
    # workspace-level totals. (Creator breakdown lands with B2 speaker mapping.)
    return UsageSummary(
        meeting_count=summary["meeting_count"],
        completed_count=summary["completed_count"],
        total_minutes=summary["total_minutes"],
        active_members=0,
        per_creator=[],
        llm_total_tokens=llm_totals["total_tokens"],
        llm_estimated_cost_usd=llm_totals["estimated_cost_usd"],
        llm_call_count=llm_totals["call_count"],
        llm_breakdown=[LlmUsageBreakdown(**row) for row in llm_breakdown_rows],
        llm_daily_trend=[LlmUsageDailyPoint(**row) for row in llm_daily_rows],
    )
