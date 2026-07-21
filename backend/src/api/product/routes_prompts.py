"""Prompt library API (workspace-scoped).

  GET/POST            /api/v1/prompts
  PATCH/DELETE        /api/v1/prompts/{prompt_id}

Reusable saved Ask prompts: an operator saves a prompt body once and reuses it
in the workspace-wide Ask feature instead of retyping it each time.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from ...prompt_library import SavedPromptsRepo
from ..database.connection import DatabaseConnection
from .deps import AuthContext, get_current_context, get_db
from .errors import ApiError
from .schemas import SavedPrompt, SavedPromptCreate, SavedPromptUpdate

router = APIRouter(prefix="/api/v1/prompts", tags=["prompts"])


async def _repo(db: DatabaseConnection = Depends(get_db)) -> SavedPromptsRepo:
    return SavedPromptsRepo(db)


def _to_prompt(row: dict) -> SavedPrompt:
    return SavedPrompt(
        id=str(row["id"]),
        title=row["title"],
        body=row["body"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


@router.get(
    "",
    response_model=list[SavedPrompt],
    summary="List saved prompts",
    description="Returns all saved Ask prompts configured for the workspace.",
)
async def list_prompts(
    ctx: AuthContext = Depends(get_current_context),
    repo: SavedPromptsRepo = Depends(_repo),
) -> list[SavedPrompt]:
    return [_to_prompt(r) for r in await repo.list(ctx.workspace.id)]


@router.post(
    "",
    response_model=SavedPrompt,
    status_code=201,
    summary="Create a saved prompt",
    description="Creates a reusable Ask prompt for the workspace.",
)
async def create_prompt(
    body: SavedPromptCreate,
    ctx: AuthContext = Depends(get_current_context),
    repo: SavedPromptsRepo = Depends(_repo),
) -> SavedPrompt:
    row = await repo.create(
        workspace_id=ctx.workspace.id,
        title=body.title.strip(),
        body=body.body,
    )
    return _to_prompt(row)


@router.patch(
    "/{prompt_id}",
    response_model=SavedPrompt,
    summary="Update a saved prompt",
    description="Updates a prompt's fields. 404 if not found in this workspace.",
)
async def update_prompt(
    prompt_id: str,
    body: SavedPromptUpdate,
    ctx: AuthContext = Depends(get_current_context),
    repo: SavedPromptsRepo = Depends(_repo),
) -> SavedPrompt:
    row = await repo.update(
        prompt_id=prompt_id,
        workspace_id=ctx.workspace.id,
        title=body.title.strip() if body.title else None,
        body=body.body,
    )
    if row is None:
        raise ApiError(404, "not_found", "Saved prompt not found")
    return _to_prompt(row)


@router.delete(
    "/{prompt_id}",
    status_code=204,
    summary="Delete a saved prompt",
    description="Deletes a prompt. 404 if not found in this workspace.",
)
async def delete_prompt(
    prompt_id: str,
    ctx: AuthContext = Depends(get_current_context),
    repo: SavedPromptsRepo = Depends(_repo),
) -> None:
    ok = await repo.delete(prompt_id=prompt_id, workspace_id=ctx.workspace.id)
    if not ok:
        raise ApiError(404, "not_found", "Saved prompt not found")
