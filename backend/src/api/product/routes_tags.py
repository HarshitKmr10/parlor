"""Meeting tags API (workspace-scoped).

  GET/POST            /api/v1/tags
  DELETE              /api/v1/tags/{tag_id}
  GET                 /api/v1/tags/meetings/{meeting_id}   (a meeting's tags)
  PUT                 /api/v1/tags/meetings/{meeting_id}    (set a meeting's tags)

Tags are workspace-defined labels (name + color) that can be assigned to
meetings for organization. Mirrors the trackers CRUD surface.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from ...tags import TagsRepo
from ..database.connection import DatabaseConnection
from .deps import AuthContext, get_current_context, get_db
from .errors import ApiError
from .schemas import MeetingTagsUpdate, Tag, TagCreate

router = APIRouter(prefix="/api/v1/tags", tags=["tags"])


async def _repo(db: DatabaseConnection = Depends(get_db)) -> TagsRepo:
    return TagsRepo(db)


def _to_tag(row: dict) -> Tag:
    return Tag(
        id=str(row["id"]),
        name=row["name"],
        color=row.get("color") or "#6b7280",
    )


# NOTE: /meetings/... is declared before /{tag_id} so it isn't shadowed.
@router.get(
    "/meetings/{meeting_id}",
    response_model=list[Tag],
    summary="List a meeting's tags",
    description="Returns the tags currently assigned to a meeting in this workspace.",
)
async def list_meeting_tags(
    meeting_id: str,
    ctx: AuthContext = Depends(get_current_context),
    repo: TagsRepo = Depends(_repo),
) -> list[Tag]:
    rows = await repo.list_for_meeting(meeting_id, ctx.workspace.id)
    return [_to_tag(r) for r in rows]


@router.put(
    "/meetings/{meeting_id}",
    response_model=list[Tag],
    summary="Set a meeting's tags",
    description=(
        "Replaces the meeting's tag assignments with the given tag IDs. Only "
        "tags belonging to this workspace are applied."
    ),
)
async def set_meeting_tags(
    meeting_id: str,
    body: MeetingTagsUpdate,
    ctx: AuthContext = Depends(get_current_context),
    repo: TagsRepo = Depends(_repo),
) -> list[Tag]:
    rows = await repo.set_for_meeting(meeting_id, ctx.workspace.id, body.tag_ids)
    return [_to_tag(r) for r in rows]


@router.get(
    "",
    response_model=list[Tag],
    summary="List tags",
    description="Returns all meeting tags defined for the workspace.",
)
async def list_tags(
    ctx: AuthContext = Depends(get_current_context),
    repo: TagsRepo = Depends(_repo),
) -> list[Tag]:
    return [_to_tag(r) for r in await repo.list(ctx.workspace.id)]


@router.post(
    "",
    response_model=Tag,
    status_code=201,
    summary="Create a tag",
    description="Creates a workspace tag (name + color) that can be assigned to meetings.",
)
async def create_tag(
    body: TagCreate,
    ctx: AuthContext = Depends(get_current_context),
    repo: TagsRepo = Depends(_repo),
) -> Tag:
    row = await repo.create(
        workspace_id=ctx.workspace.id,
        name=body.name.strip(),
        color=body.color.strip() or "#6b7280",
    )
    return _to_tag(row)


@router.delete(
    "/{tag_id}",
    status_code=204,
    summary="Delete a tag",
    description="Deletes a tag and removes it from any meetings. 404 if not found in this workspace.",
)
async def delete_tag(
    tag_id: str,
    ctx: AuthContext = Depends(get_current_context),
    repo: TagsRepo = Depends(_repo),
) -> None:
    ok = await repo.delete(tag_id=tag_id, workspace_id=ctx.workspace.id)
    if not ok:
        raise ApiError(404, "not_found", "Tag not found")
