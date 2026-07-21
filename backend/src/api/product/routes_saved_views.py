"""Saved views API (workspace-scoped).

  GET/POST            /api/v1/saved-views
  PATCH/DELETE        /api/v1/saved-views/{view_id}

Named, reusable saved searches: an operator saves a query string (plus optional
structured filters) once and re-runs it with one click instead of retyping the
search each time.
"""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends

from ...saved_views import SavedViewsRepo
from ..database.connection import DatabaseConnection
from .deps import AuthContext, get_current_context, get_db
from .errors import ApiError
from .schemas import SavedView, SavedViewCreate, SavedViewUpdate

router = APIRouter(prefix="/api/v1/saved-views", tags=["saved-views"])


async def _repo(db: DatabaseConnection = Depends(get_db)) -> SavedViewsRepo:
    return SavedViewsRepo(db)


def _filters(raw):
    if isinstance(raw, str):
        try:
            return json.loads(raw)
        except (ValueError, TypeError):
            return {}
    return raw or {}


def _to_view(row: dict) -> SavedView:
    return SavedView(
        id=str(row["id"]),
        name=row["name"],
        query=row["query"],
        filters=_filters(row.get("filters")),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


@router.get(
    "",
    response_model=list[SavedView],
    summary="List saved views",
    description="Returns all saved searches configured for the workspace.",
)
async def list_saved_views(
    ctx: AuthContext = Depends(get_current_context),
    repo: SavedViewsRepo = Depends(_repo),
) -> list[SavedView]:
    return [_to_view(r) for r in await repo.list(ctx.workspace.id)]


@router.post(
    "",
    response_model=SavedView,
    status_code=201,
    summary="Create a saved view",
    description="Creates a reusable saved search for the workspace.",
)
async def create_saved_view(
    body: SavedViewCreate,
    ctx: AuthContext = Depends(get_current_context),
    repo: SavedViewsRepo = Depends(_repo),
) -> SavedView:
    row = await repo.create(
        workspace_id=ctx.workspace.id,
        name=body.name.strip(),
        query=body.query,
        filters=body.filters,
    )
    return _to_view(row)


@router.patch(
    "/{view_id}",
    response_model=SavedView,
    summary="Update a saved view",
    description="Updates a view's fields. 404 if not found in this workspace.",
)
async def update_saved_view(
    view_id: str,
    body: SavedViewUpdate,
    ctx: AuthContext = Depends(get_current_context),
    repo: SavedViewsRepo = Depends(_repo),
) -> SavedView:
    row = await repo.update(
        view_id=view_id,
        workspace_id=ctx.workspace.id,
        name=body.name.strip() if body.name else None,
        query=body.query,
        filters=body.filters,
    )
    if row is None:
        raise ApiError(404, "not_found", "Saved view not found")
    return _to_view(row)


@router.delete(
    "/{view_id}",
    status_code=204,
    summary="Delete a saved view",
    description="Deletes a view. 404 if not found in this workspace.",
)
async def delete_saved_view(
    view_id: str,
    ctx: AuthContext = Depends(get_current_context),
    repo: SavedViewsRepo = Depends(_repo),
) -> None:
    ok = await repo.delete(view_id=view_id, workspace_id=ctx.workspace.id)
    if not ok:
        raise ApiError(404, "not_found", "Saved view not found")
