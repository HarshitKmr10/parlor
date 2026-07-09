"""Meeting comments + @mentions API (workspace-scoped).

  POST   /api/v1/meetings/{meeting_id}/comments
  GET    /api/v1/meetings/{meeting_id}/comments
  PATCH  /api/v1/meetings/{meeting_id}/comments/{comment_id}
  DELETE /api/v1/meetings/{meeting_id}/comments/{comment_id}

Comments anchor to a timestamp/segment for moment-level review. @mentions are
validated against workspace membership. Editing the body and deleting are
author-only; toggling ``resolved`` is open to any workspace member.
"""

from __future__ import annotations

from typing import Dict, List

from fastapi import APIRouter, Depends

from ...comments import CommentsRepo
from ..database.connection import DatabaseConnection
from .deps import AuthContext, get_current_context, get_db
from .errors import ApiError
from .meetings_repo import ProductMeetingsRepo
from .schemas import (
    Comment,
    CommentAuthor,
    CommentCreate,
    CommentListResponse,
    CommentUpdate,
)

router = APIRouter(prefix="/api/v1", tags=["comments"])


async def _repo(db: DatabaseConnection = Depends(get_db)) -> CommentsRepo:
    return CommentsRepo(db)


async def _meetings_repo(
    db: DatabaseConnection = Depends(get_db),
) -> ProductMeetingsRepo:
    return ProductMeetingsRepo(db)


def _require_user(ctx: AuthContext) -> str:
    if ctx.user is None:
        raise ApiError(403, "user_required", "Comments require a logged-in user")
    return ctx.user.id


async def _assert_meeting(
    meeting_id: str, workspace_id: str, meetings: ProductMeetingsRepo
) -> None:
    if await meetings.get_scoped(meeting_id, workspace_id) is None:
        raise ApiError(404, "not_found", "Meeting not found in this workspace")


def _to_comment(row: dict, names: Dict[str, str]) -> Comment:
    author_id = row.get("author_id")
    return Comment(
        id=row["id"],
        meeting_id=row["meeting_id"],
        parent_id=row.get("parent_id"),
        author=CommentAuthor(id=author_id, name=names.get(author_id or "", "Unknown")),
        body=row["body"],
        anchor_t_sec=row.get("anchor_t_sec"),
        anchor_segment_id=row.get("anchor_segment_id"),
        mentions=[
            CommentAuthor(id=uid, name=names.get(uid, "Unknown"))
            for uid in row.get("mentioned_user_ids", [])
        ],
        resolved=bool(row.get("resolved")),
        edited=bool(row.get("edited")),
        created_at=row["created_at"],
        updated_at=row.get("updated_at"),
    )


def _name_ids(rows: List[dict]) -> List[str]:
    ids: List[str] = []
    for r in rows:
        if r.get("author_id"):
            ids.append(r["author_id"])
        ids.extend(r.get("mentioned_user_ids", []))
    return ids


@router.post(
    "/meetings/{meeting_id}/comments",
    response_model=Comment,
    status_code=201,
    summary="Add a comment to a meeting",
    description=(
        "Adds a comment (optionally anchored to a transcript timestamp/"
        "segment, and/or threaded under a parent comment) to a meeting. "
        "`mentions` are filtered against workspace membership; each valid "
        "mention gets a best-effort notification."
    ),
)
async def create_comment(
    meeting_id: str,
    body: CommentCreate,
    ctx: AuthContext = Depends(get_current_context),
    repo: CommentsRepo = Depends(_repo),
    meetings: ProductMeetingsRepo = Depends(_meetings_repo),
) -> Comment:
    author_id = _require_user(ctx)
    await _assert_meeting(meeting_id, ctx.workspace.id, meetings)

    if body.parent_id is not None:
        parent = await repo.get(body.parent_id, ctx.workspace.id)
        if parent is None or parent["meeting_id"] != meeting_id:
            raise ApiError(400, "invalid_parent", "Parent comment not found")

    mentions = await repo.filter_members(ctx.workspace.id, body.mentions)
    row = await repo.create(
        meeting_id=meeting_id,
        workspace_id=ctx.workspace.id,
        author_id=author_id,
        parent_id=body.parent_id,
        body=body.body,
        anchor_t_sec=body.anchor_t_sec,
        anchor_segment_id=body.anchor_segment_id,
        mentioned_user_ids=mentions,
    )
    names = await repo.names_for(_name_ids([row]))

    # Notify each mentioned member (best-effort; never blocks the comment).
    if mentions:
        from ...notifications import notify

        author_name = names.get(author_id, "Someone")
        await notify(
            meetings._db if hasattr(meetings, "_db") else repo._db,
            workspace_id=ctx.workspace.id,
            user_ids=mentions,
            type="mention",
            title=f"{author_name} mentioned you",
            body=body.body[:200],
            link=f"/meetings/{meeting_id}#comments",
            meeting_id=meeting_id,
            actor_id=author_id,
        )

    return _to_comment(row, names)


@router.get(
    "/meetings/{meeting_id}/comments",
    response_model=CommentListResponse,
    summary="List comments for a meeting",
    description="Returns all comments (with author and mention names resolved) for one meeting.",
)
async def list_comments(
    meeting_id: str,
    ctx: AuthContext = Depends(get_current_context),
    repo: CommentsRepo = Depends(_repo),
    meetings: ProductMeetingsRepo = Depends(_meetings_repo),
) -> CommentListResponse:
    await _assert_meeting(meeting_id, ctx.workspace.id, meetings)
    rows = await repo.list_for_meeting(meeting_id, ctx.workspace.id)
    names = await repo.names_for(_name_ids(rows))
    items = [_to_comment(r, names) for r in rows]
    return CommentListResponse(items=items, total=len(items))


@router.patch(
    "/meetings/{meeting_id}/comments/{comment_id}",
    response_model=Comment,
    summary="Update a comment",
    description=(
        "Edits a comment's body/mentions (author-only, 403 otherwise) and/or "
        "toggles its `resolved` flag (open to any workspace member). 404 if "
        "not found in this meeting/workspace."
    ),
)
async def update_comment(
    meeting_id: str,
    comment_id: str,
    body: CommentUpdate,
    ctx: AuthContext = Depends(get_current_context),
    repo: CommentsRepo = Depends(_repo),
) -> Comment:
    user_id = _require_user(ctx)
    existing = await repo.get(comment_id, ctx.workspace.id)
    if existing is None or existing["meeting_id"] != meeting_id:
        raise ApiError(404, "not_found", "Comment not found")

    row = existing
    # Body edits (and the mentions that go with them) are author-only.
    if body.body is not None:
        if existing.get("author_id") != user_id:
            raise ApiError(403, "forbidden", "Only the author can edit this comment")
        mentions = (
            await repo.filter_members(ctx.workspace.id, body.mentions)
            if body.mentions is not None
            else existing.get("mentioned_user_ids", [])
        )
        row = await repo.update_body(
            comment_id=comment_id,
            workspace_id=ctx.workspace.id,
            body=body.body,
            mentioned_user_ids=mentions,
        )

    # Resolving is a collaborative action — any workspace member may toggle it.
    if body.resolved is not None:
        row = await repo.set_resolved(
            comment_id=comment_id,
            workspace_id=ctx.workspace.id,
            resolved=body.resolved,
        )

    if row is None:
        raise ApiError(404, "not_found", "Comment not found")
    names = await repo.names_for(_name_ids([row]))
    return _to_comment(row, names)


@router.delete(
    "/meetings/{meeting_id}/comments/{comment_id}",
    status_code=204,
    summary="Delete a comment",
    description="Deletes a comment (author-only, 403 otherwise). 404 if not found in this meeting/workspace.",
)
async def delete_comment(
    meeting_id: str,
    comment_id: str,
    ctx: AuthContext = Depends(get_current_context),
    repo: CommentsRepo = Depends(_repo),
) -> None:
    user_id = _require_user(ctx)
    existing = await repo.get(comment_id, ctx.workspace.id)
    if existing is None or existing["meeting_id"] != meeting_id:
        raise ApiError(404, "not_found", "Comment not found")
    if existing.get("author_id") != user_id:
        raise ApiError(403, "forbidden", "Only the author can delete this comment")
    await repo.delete(comment_id, ctx.workspace.id)
