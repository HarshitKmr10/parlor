"""Capture exclusions API (workspace-scoped).

  GET/POST      /api/v1/capture-exclusions
  PATCH/DELETE  /api/v1/capture-exclusions/{exclusion_id}

Do-not-record rules: patterns that match a meeting's title or URL so Parlor
never auto-joins or records those meetings. The pattern is validated up front —
an unknown match type or an uncompilable regex returns 422. Entirely local;
nothing leaves the machine.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from ...capture_exclusions import (
    CaptureExclusionsRepo,
    InvalidExclusionError,
    validate_rule,
)
from ..database.connection import DatabaseConnection
from .deps import AuthContext, get_current_context, get_db
from .errors import ApiError
from .schemas import (
    CaptureExclusion,
    CaptureExclusionCreate,
    CaptureExclusionUpdate,
)

router = APIRouter(prefix="/api/v1/capture-exclusions", tags=["capture-exclusions"])


async def _repo(db: DatabaseConnection = Depends(get_db)) -> CaptureExclusionsRepo:
    return CaptureExclusionsRepo(db)


def _to_exclusion(row: dict) -> CaptureExclusion:
    return CaptureExclusion(
        id=str(row["id"]),
        pattern=row["pattern"],
        match_type=row["match_type"],
        note=row.get("note"),
        enabled=bool(row["enabled"]),
    )


@router.get(
    "",
    response_model=list[CaptureExclusion],
    summary="List capture exclusions",
    description="Returns all do-not-record rules configured for the workspace.",
)
async def list_exclusions(
    ctx: AuthContext = Depends(get_current_context),
    repo: CaptureExclusionsRepo = Depends(_repo),
) -> list[CaptureExclusion]:
    return [_to_exclusion(r) for r in await repo.list(ctx.workspace.id)]


@router.post(
    "",
    response_model=CaptureExclusion,
    status_code=201,
    summary="Create a capture exclusion",
    description=(
        "Creates a do-not-record rule. The pattern is validated up front — an "
        "unknown match type or an uncompilable title regex returns 422."
    ),
)
async def create_exclusion(
    body: CaptureExclusionCreate,
    ctx: AuthContext = Depends(get_current_context),
    repo: CaptureExclusionsRepo = Depends(_repo),
) -> CaptureExclusion:
    try:
        validate_rule(body.match_type, body.pattern)
    except InvalidExclusionError as exc:
        raise ApiError(422, "invalid_exclusion", str(exc)) from exc
    row = await repo.create(
        workspace_id=ctx.workspace.id,
        pattern=body.pattern.strip(),
        match_type=body.match_type,
        note=body.note.strip() if body.note else None,
    )
    return _to_exclusion(row)


@router.patch(
    "/{exclusion_id}",
    response_model=CaptureExclusion,
    summary="Update a capture exclusion",
    description="Updates a rule's fields. 404 if not found in this workspace, 422 for an invalid pattern.",
)
async def update_exclusion(
    exclusion_id: str,
    body: CaptureExclusionUpdate,
    ctx: AuthContext = Depends(get_current_context),
    repo: CaptureExclusionsRepo = Depends(_repo),
) -> CaptureExclusion:
    if body.pattern is not None or body.match_type is not None:
        existing = await repo.list(ctx.workspace.id)
        current = next(
            (r for r in existing if str(r["id"]) == exclusion_id), None
        )
        if current is None:
            raise ApiError(404, "not_found", "Capture exclusion not found")
        match_type = body.match_type or current["match_type"]
        pattern = body.pattern if body.pattern is not None else current["pattern"]
        try:
            validate_rule(match_type, pattern)
        except InvalidExclusionError as exc:
            raise ApiError(422, "invalid_exclusion", str(exc)) from exc
    row = await repo.update(
        exclusion_id=exclusion_id,
        workspace_id=ctx.workspace.id,
        pattern=body.pattern.strip() if body.pattern else None,
        match_type=body.match_type,
        note=body.note.strip() if body.note else None,
        enabled=body.enabled,
    )
    if row is None:
        raise ApiError(404, "not_found", "Capture exclusion not found")
    return _to_exclusion(row)


@router.delete(
    "/{exclusion_id}",
    status_code=204,
    summary="Delete a capture exclusion",
    description="Deletes a rule. 404 if not found in this workspace.",
)
async def delete_exclusion(
    exclusion_id: str,
    ctx: AuthContext = Depends(get_current_context),
    repo: CaptureExclusionsRepo = Depends(_repo),
) -> None:
    ok = await repo.delete(exclusion_id=exclusion_id, workspace_id=ctx.workspace.id)
    if not ok:
        raise ApiError(404, "not_found", "Capture exclusion not found")
