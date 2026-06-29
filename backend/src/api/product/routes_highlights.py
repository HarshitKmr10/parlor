"""Meeting highlights / clips API (workspace-scoped).

Endpoints:
  POST   /api/v1/meetings/{meeting_id}/highlights
  GET    /api/v1/meetings/{meeting_id}/highlights
  PATCH  /api/v1/meetings/{meeting_id}/highlights/{highlight_id}
  DELETE /api/v1/meetings/{meeting_id}/highlights/{highlight_id}
  GET    /api/v1/highlights                       (cross-meeting reel)

On create/update the transcript text covering the clip window is snapshotted
onto the highlight so the reel stays readable if the transcript later changes.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query

from ...highlights import HighlightsRepo, extract_excerpt
from ...services.meeting_service import MeetingService
from ..database.connection import DatabaseConnection
from .deps import AuthContext, get_current_context, get_db
from .errors import ApiError
from .mappers import segments_from_transcript
from .meetings_repo import ProductMeetingsRepo
from .schemas import (
    Highlight,
    HighlightCreate,
    HighlightListResponse,
    HighlightUpdate,
    WorkspaceHighlight,
    WorkspaceHighlightListResponse,
)

router = APIRouter(prefix="/api/v1", tags=["highlights"])


async def _repo(db: DatabaseConnection = Depends(get_db)) -> HighlightsRepo:
    return HighlightsRepo(db)


async def _service(db: DatabaseConnection = Depends(get_db)) -> MeetingService:
    return MeetingService(db)


async def _meetings_repo(
    db: DatabaseConnection = Depends(get_db),
) -> ProductMeetingsRepo:
    return ProductMeetingsRepo(db)


async def _assert_meeting(
    meeting_id: str, workspace_id: str, meetings: ProductMeetingsRepo
) -> None:
    if await meetings.get_scoped(meeting_id, workspace_id) is None:
        raise ApiError(404, "not_found", "Meeting not found in this workspace")


async def _excerpt_for(
    meeting_id: str, t_start: float, t_end: float, service: MeetingService
) -> str:
    record = await service.get_meeting_by_id(meeting_id)
    if record is None:
        return ""
    segments = segments_from_transcript(record.transcript)
    return extract_excerpt(segments, t_start, t_end)


@router.post(
    "/meetings/{meeting_id}/highlights",
    response_model=Highlight,
    status_code=201,
)
async def create_highlight(
    meeting_id: str,
    body: HighlightCreate,
    ctx: AuthContext = Depends(get_current_context),
    repo: HighlightsRepo = Depends(_repo),
    meetings: ProductMeetingsRepo = Depends(_meetings_repo),
    service: MeetingService = Depends(_service),
) -> Highlight:
    await _assert_meeting(meeting_id, ctx.workspace.id, meetings)
    excerpt = await _excerpt_for(meeting_id, body.t_start_sec, body.t_end_sec, service)
    row = await repo.create(
        meeting_id=meeting_id,
        workspace_id=ctx.workspace.id,
        created_by=ctx.user.id if ctx.user else None,
        t_start_sec=body.t_start_sec,
        t_end_sec=body.t_end_sec,
        label=body.label,
        note=body.note,
        color=body.color,
        excerpt=excerpt or None,
    )
    return Highlight.model_validate(row)


@router.get(
    "/meetings/{meeting_id}/highlights",
    response_model=HighlightListResponse,
)
async def list_highlights(
    meeting_id: str,
    ctx: AuthContext = Depends(get_current_context),
    repo: HighlightsRepo = Depends(_repo),
    meetings: ProductMeetingsRepo = Depends(_meetings_repo),
) -> HighlightListResponse:
    await _assert_meeting(meeting_id, ctx.workspace.id, meetings)
    rows = await repo.list_for_meeting(meeting_id, ctx.workspace.id)
    items = [Highlight.model_validate(r) for r in rows]
    return HighlightListResponse(items=items, total=len(items))


@router.patch(
    "/meetings/{meeting_id}/highlights/{highlight_id}",
    response_model=Highlight,
)
async def update_highlight(
    meeting_id: str,
    highlight_id: str,
    body: HighlightUpdate,
    ctx: AuthContext = Depends(get_current_context),
    repo: HighlightsRepo = Depends(_repo),
    service: MeetingService = Depends(_service),
) -> Highlight:
    existing = await repo.get(highlight_id, ctx.workspace.id)
    if existing is None or str(existing["meeting_id"]) != meeting_id:
        raise ApiError(404, "not_found", "Highlight not found")

    # Validate the effective range and re-snapshot the excerpt if it moved.
    new_start = (
        body.t_start_sec if body.t_start_sec is not None else existing["t_start_sec"]
    )
    new_end = body.t_end_sec if body.t_end_sec is not None else existing["t_end_sec"]
    if new_end < new_start:
        raise ApiError(400, "invalid_range", "tEndSec must be >= tStartSec")

    excerpt: Optional[str] = None
    if body.t_start_sec is not None or body.t_end_sec is not None:
        excerpt = await _excerpt_for(meeting_id, new_start, new_end, service) or None

    row = await repo.update(
        highlight_id=highlight_id,
        workspace_id=ctx.workspace.id,
        t_start_sec=body.t_start_sec,
        t_end_sec=body.t_end_sec,
        label=body.label,
        note=body.note,
        color=body.color,
        excerpt=excerpt,
    )
    if row is None:
        raise ApiError(404, "not_found", "Highlight not found")
    return Highlight.model_validate(row)


@router.delete(
    "/meetings/{meeting_id}/highlights/{highlight_id}",
    status_code=204,
)
async def delete_highlight(
    meeting_id: str,
    highlight_id: str,
    ctx: AuthContext = Depends(get_current_context),
    repo: HighlightsRepo = Depends(_repo),
) -> None:
    existing = await repo.get(highlight_id, ctx.workspace.id)
    if existing is None or str(existing["meeting_id"]) != meeting_id:
        raise ApiError(404, "not_found", "Highlight not found")
    await repo.delete(highlight_id, ctx.workspace.id)


@router.get("/highlights", response_model=WorkspaceHighlightListResponse)
async def list_workspace_highlights(
    ctx: AuthContext = Depends(get_current_context),
    repo: HighlightsRepo = Depends(_repo),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> WorkspaceHighlightListResponse:
    """Cross-meeting highlights reel for the workspace, newest first."""
    rows = await repo.list_for_workspace(ctx.workspace.id, limit=limit, offset=offset)
    total = await repo.count_for_workspace(ctx.workspace.id)
    items = [WorkspaceHighlight.model_validate(r) for r in rows]
    return WorkspaceHighlightListResponse(
        items=items, total=total, limit=limit, offset=offset
    )
