"""Action items / tasks API (workspace-scoped).

GET    /api/v1/meetings/{meeting_id}/action-items     per-meeting list
POST   /api/v1/meetings/{meeting_id}/action-items     add a manual task
GET    /api/v1/action-items?assignee=&done=           cross-meeting "my tasks"
PATCH  /api/v1/action-items/{id}                       edit / assign / complete
DELETE /api/v1/action-items/{id}
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query

from ...action_items import ActionItemsRepo
from ..database.connection import DatabaseConnection
from .deps import AuthContext, get_current_context, get_db
from .errors import ApiError
from .meetings_repo import ProductMeetingsRepo
from .schemas import (
    ActionItemCreate,
    ActionItemListResponse,
    ActionItemRecord,
    ActionItemUpdate,
)

router = APIRouter(prefix="/api/v1", tags=["action-items"])


async def _repo(db: DatabaseConnection = Depends(get_db)) -> ActionItemsRepo:
    return ActionItemsRepo(db)


async def _meetings_repo(
    db: DatabaseConnection = Depends(get_db),
) -> ProductMeetingsRepo:
    return ProductMeetingsRepo(db)


@router.get(
    "/meetings/{meeting_id}/action-items", response_model=ActionItemListResponse
)
async def list_meeting_action_items(
    meeting_id: str,
    ctx: AuthContext = Depends(get_current_context),
    repo: ActionItemsRepo = Depends(_repo),
    meetings: ProductMeetingsRepo = Depends(_meetings_repo),
) -> ActionItemListResponse:
    if await meetings.get_scoped(meeting_id, ctx.workspace.id) is None:
        raise ApiError(404, "not_found", "Meeting not found in this workspace")
    rows = await repo.list_for_meeting(meeting_id, ctx.workspace.id)
    items = [ActionItemRecord.model_validate(r) for r in rows]
    return ActionItemListResponse(items=items, total=len(items))


@router.post(
    "/meetings/{meeting_id}/action-items",
    response_model=ActionItemRecord,
    status_code=201,
)
async def create_action_item(
    meeting_id: str,
    body: ActionItemCreate,
    ctx: AuthContext = Depends(get_current_context),
    repo: ActionItemsRepo = Depends(_repo),
    meetings: ProductMeetingsRepo = Depends(_meetings_repo),
) -> ActionItemRecord:
    if await meetings.get_scoped(meeting_id, ctx.workspace.id) is None:
        raise ApiError(404, "not_found", "Meeting not found in this workspace")
    row = await repo.create(
        workspace_id=ctx.workspace.id,
        meeting_id=meeting_id,
        created_by=ctx.user.id if ctx.user else None,
        text=body.text,
        assignee=body.assignee,
        due_date=body.due_date,
        source="manual",
    )
    return ActionItemRecord.model_validate(row)


@router.get("/action-items", response_model=ActionItemListResponse)
async def list_workspace_action_items(
    assignee: Optional[str] = Query(None),
    done: Optional[bool] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    ctx: AuthContext = Depends(get_current_context),
    repo: ActionItemsRepo = Depends(_repo),
) -> ActionItemListResponse:
    """Cross-meeting task list — filter by assignee and/or open/done."""
    rows = await repo.list_for_workspace(
        ctx.workspace.id, assignee=assignee, done=done, limit=limit, offset=offset
    )
    items = [ActionItemRecord.model_validate(r) for r in rows]
    return ActionItemListResponse(items=items, total=len(items))


@router.patch("/action-items/{item_id}", response_model=ActionItemRecord)
async def update_action_item(
    item_id: str,
    body: ActionItemUpdate,
    ctx: AuthContext = Depends(get_current_context),
    repo: ActionItemsRepo = Depends(_repo),
) -> ActionItemRecord:
    row = await repo.update(
        item_id=item_id,
        workspace_id=ctx.workspace.id,
        text=body.text,
        assignee=body.assignee,
        due_date=body.due_date,
        done=body.done,
    )
    if row is None:
        raise ApiError(404, "not_found", "Action item not found")
    return ActionItemRecord.model_validate(row)


@router.delete("/action-items/{item_id}", status_code=204)
async def delete_action_item(
    item_id: str,
    ctx: AuthContext = Depends(get_current_context),
    repo: ActionItemsRepo = Depends(_repo),
) -> None:
    if not await repo.delete(item_id, ctx.workspace.id):
        raise ApiError(404, "not_found", "Action item not found")
