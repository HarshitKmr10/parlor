"""Per-user notifications / activity inbox API (workspace-scoped).

  GET   /api/v1/notifications?unreadOnly=
  POST  /api/v1/notifications/{id}/read
  POST  /api/v1/notifications/read-all

The current user is derived from the auth context; rows are always scoped to
(workspace, user) so one member never sees another's feed.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from ...notifications import NotificationsRepo
from ..database.connection import DatabaseConnection
from .deps import AuthContext, get_current_context, get_db
from .errors import ApiError
from .schemas import Notification, NotificationListResponse

router = APIRouter(prefix="/api/v1/notifications", tags=["notifications"])


async def _repo(db: DatabaseConnection = Depends(get_db)) -> NotificationsRepo:
    return NotificationsRepo(db)


def _require_user(ctx: AuthContext) -> str:
    if ctx.user is None:
        raise ApiError(401, "unauthenticated", "A user session is required")
    return ctx.user.id


def _to_model(row: dict) -> Notification:
    return Notification(
        id=str(row["id"]),
        type=row["type"],
        title=row["title"],
        body=row.get("body"),
        link=row.get("link"),
        meeting_id=str(row["meeting_id"]) if row.get("meeting_id") else None,
        read=bool(row["read"]),
        created_at=row["created_at"],
    )


@router.get(
    "",
    response_model=NotificationListResponse,
    summary="List notifications",
    description=(
        "Returns the current user's notification feed within the workspace "
        "(scoped to workspace + user, so one member never sees another's "
        "feed), plus the unread count. Optionally filter to unread only."
    ),
)
async def list_notifications(
    unread_only: bool = Query(False, alias="unreadOnly"),
    limit: int = Query(50, ge=1, le=200),
    ctx: AuthContext = Depends(get_current_context),
    repo: NotificationsRepo = Depends(_repo),
) -> NotificationListResponse:
    user_id = _require_user(ctx)
    rows = await repo.list_for_user(
        workspace_id=ctx.workspace.id,
        user_id=user_id,
        limit=limit,
        unread_only=unread_only,
    )
    unread = await repo.unread_count(workspace_id=ctx.workspace.id, user_id=user_id)
    return NotificationListResponse(
        items=[_to_model(r) for r in rows], unread=unread
    )


@router.post(
    "/{notification_id}/read",
    status_code=204,
    summary="Mark a notification as read",
    description="Marks a single notification read for the current user. 404 if it doesn't belong to them.",
)
async def mark_read(
    notification_id: str,
    ctx: AuthContext = Depends(get_current_context),
    repo: NotificationsRepo = Depends(_repo),
) -> None:
    user_id = _require_user(ctx)
    ok = await repo.mark_read(
        notification_id=notification_id,
        workspace_id=ctx.workspace.id,
        user_id=user_id,
    )
    if not ok:
        raise ApiError(404, "not_found", "Notification not found")


@router.post(
    "/read-all",
    status_code=204,
    summary="Mark all notifications as read",
    description="Marks every unread notification for the current user, in this workspace, as read.",
)
async def mark_all_read(
    ctx: AuthContext = Depends(get_current_context),
    repo: NotificationsRepo = Depends(_repo),
) -> None:
    user_id = _require_user(ctx)
    await repo.mark_all_read(workspace_id=ctx.workspace.id, user_id=user_id)
