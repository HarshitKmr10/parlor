"""Topic / keyword trackers API (workspace-scoped).

  GET/POST            /api/v1/trackers
  PATCH/DELETE        /api/v1/trackers/{id}
  GET                 /api/v1/trackers/hits?trackerId=

Trackers flag keyword mentions across meetings; hits are recorded when a meeting
is summarized and surface here + in notifications.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query

from ...trackers import TrackersRepo
from ..database.connection import DatabaseConnection
from .deps import AuthContext, get_current_context, get_db
from .errors import ApiError
from .schemas import (
    Tracker,
    TrackerCreate,
    TrackerHit,
    TrackerHitListResponse,
    TrackerUpdate,
)

router = APIRouter(prefix="/api/v1/trackers", tags=["trackers"])


async def _repo(db: DatabaseConnection = Depends(get_db)) -> TrackersRepo:
    return TrackersRepo(db)


def _to_tracker(row: dict) -> Tracker:
    return Tracker(
        id=str(row["id"]),
        name=row["name"],
        keywords=list(row.get("keywords") or []),
        enabled=bool(row["enabled"]),
    )


def _to_hit(row: dict) -> TrackerHit:
    return TrackerHit(
        id=str(row["id"]),
        tracker_id=str(row["tracker_id"]),
        meeting_id=str(row["meeting_id"]),
        matched_keyword=row["matched_keyword"],
        snippet=row["snippet"],
        segment_id=row.get("segment_id"),
        t_start_sec=float(row.get("t_start_sec") or 0),
        created_at=row["created_at"],
    )


def _norm(keywords) -> list[str]:
    return [str(k).strip() for k in (keywords or []) if str(k).strip()]


# NOTE: /hits must be declared before /{tracker_id} so it isn't shadowed.
@router.get(
    "/hits",
    response_model=TrackerHitListResponse,
    summary="List tracker hits",
    description=(
        "Returns recorded keyword-tracker matches for the workspace, "
        "optionally filtered to a single tracker. Hits are recorded when a "
        "meeting is summarized."
    ),
)
async def list_hits(
    tracker_id: Optional[str] = Query(None, alias="trackerId"),
    ctx: AuthContext = Depends(get_current_context),
    repo: TrackersRepo = Depends(_repo),
) -> TrackerHitListResponse:
    rows = await repo.list_hits(workspace_id=ctx.workspace.id, tracker_id=tracker_id)
    items = [_to_hit(r) for r in rows]
    return TrackerHitListResponse(items=items, total=len(items))


@router.get(
    "",
    response_model=list[Tracker],
    summary="List trackers",
    description="Returns all keyword trackers configured for the workspace.",
)
async def list_trackers(
    ctx: AuthContext = Depends(get_current_context),
    repo: TrackersRepo = Depends(_repo),
) -> list[Tracker]:
    return [_to_tracker(r) for r in await repo.list(ctx.workspace.id)]


@router.post(
    "",
    response_model=Tracker,
    status_code=201,
    summary="Create a tracker",
    description=(
        "Creates a keyword tracker. Future meeting summarizations will flag "
        "mentions of its keywords as hits and surface them in notifications."
    ),
)
async def create_tracker(
    body: TrackerCreate,
    ctx: AuthContext = Depends(get_current_context),
    repo: TrackersRepo = Depends(_repo),
) -> Tracker:
    row = await repo.create(
        workspace_id=ctx.workspace.id, name=body.name.strip(), keywords=_norm(body.keywords)
    )
    return _to_tracker(row)


@router.patch(
    "/{tracker_id}",
    response_model=Tracker,
    summary="Update a tracker",
    description="Updates a tracker's name, keywords, and/or enabled state. 404 if not found in this workspace.",
)
async def update_tracker(
    tracker_id: str,
    body: TrackerUpdate,
    ctx: AuthContext = Depends(get_current_context),
    repo: TrackersRepo = Depends(_repo),
) -> Tracker:
    row = await repo.update(
        tracker_id=tracker_id,
        workspace_id=ctx.workspace.id,
        name=body.name.strip() if body.name else None,
        keywords=_norm(body.keywords) if body.keywords is not None else None,
        enabled=body.enabled,
    )
    if row is None:
        raise ApiError(404, "not_found", "Tracker not found")
    return _to_tracker(row)


@router.delete(
    "/{tracker_id}",
    status_code=204,
    summary="Delete a tracker",
    description="Deletes a tracker. 404 if not found in this workspace.",
)
async def delete_tracker(
    tracker_id: str,
    ctx: AuthContext = Depends(get_current_context),
    repo: TrackersRepo = Depends(_repo),
) -> None:
    ok = await repo.delete(tracker_id=tracker_id, workspace_id=ctx.workspace.id)
    if not ok:
        raise ApiError(404, "not_found", "Tracker not found")
