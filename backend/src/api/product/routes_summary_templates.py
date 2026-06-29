"""Custom summary templates API (workspace-scoped).

GET    /api/v1/summary-templates/presets   built-in starter templates
GET    /api/v1/summary-templates           list workspace templates
POST   /api/v1/summary-templates           create (optionally from a preset)
GET    /api/v1/summary-templates/{id}
PATCH  /api/v1/summary-templates/{id}
DELETE /api/v1/summary-templates/{id}
"""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends

from ...summary_templates import PRESETS, SummaryTemplatesRepo, preset_by_key
from ..database.connection import DatabaseConnection
from .deps import AuthContext, get_current_context, get_db
from .errors import ApiError
from .schemas import (
    SummaryTemplate,
    SummaryTemplateCreate,
    SummaryTemplatePreset,
    SummaryTemplateUpdate,
)

router = APIRouter(prefix="/api/v1/summary-templates", tags=["summary-templates"])


async def _repo(db: DatabaseConnection = Depends(get_db)) -> SummaryTemplatesRepo:
    return SummaryTemplatesRepo(db)


@router.get("/presets", response_model=List[SummaryTemplatePreset])
async def list_presets(
    _: AuthContext = Depends(get_current_context),
) -> List[SummaryTemplatePreset]:
    return [SummaryTemplatePreset.model_validate(p) for p in PRESETS]


@router.get("", response_model=List[SummaryTemplate])
async def list_templates(
    ctx: AuthContext = Depends(get_current_context),
    repo: SummaryTemplatesRepo = Depends(_repo),
) -> List[SummaryTemplate]:
    rows = await repo.list_for_workspace(ctx.workspace.id)
    return [SummaryTemplate.model_validate(r) for r in rows]


@router.post("", response_model=SummaryTemplate, status_code=201)
async def create_template(
    body: SummaryTemplateCreate,
    ctx: AuthContext = Depends(get_current_context),
    repo: SummaryTemplatesRepo = Depends(_repo),
) -> SummaryTemplate:
    name, instructions, sections = body.name, body.instructions, body.sections
    if body.from_preset:
        preset = preset_by_key(body.from_preset)
        if preset is None:
            raise ApiError(400, "unknown_preset", f"No preset '{body.from_preset}'")
        # Explicit fields win over the preset; preset fills the gaps.
        name = body.name or str(preset["name"])
        instructions = body.instructions or str(preset["instructions"])
        sections = body.sections or list(preset["sections"])  # type: ignore[arg-type]

    try:
        row = await repo.create(
            workspace_id=ctx.workspace.id,
            created_by=ctx.user.id if ctx.user else None,
            name=name,
            instructions=instructions,
            sections=sections,
            is_default=body.is_default,
        )
    except Exception as exc:  # noqa: BLE001 — surface the unique-name clash cleanly
        if "summary_templates_ws_name_uk" in str(exc):
            raise ApiError(409, "duplicate_name", "A template with that name exists")
        raise
    return SummaryTemplate.model_validate(row)


@router.get("/{template_id}", response_model=SummaryTemplate)
async def get_template(
    template_id: str,
    ctx: AuthContext = Depends(get_current_context),
    repo: SummaryTemplatesRepo = Depends(_repo),
) -> SummaryTemplate:
    row = await repo.get(template_id, ctx.workspace.id)
    if row is None:
        raise ApiError(404, "not_found", "Summary template not found")
    return SummaryTemplate.model_validate(row)


@router.patch("/{template_id}", response_model=SummaryTemplate)
async def update_template(
    template_id: str,
    body: SummaryTemplateUpdate,
    ctx: AuthContext = Depends(get_current_context),
    repo: SummaryTemplatesRepo = Depends(_repo),
) -> SummaryTemplate:
    row = await repo.update(
        template_id=template_id,
        workspace_id=ctx.workspace.id,
        name=body.name,
        instructions=body.instructions,
        sections=body.sections,
        is_default=body.is_default,
    )
    if row is None:
        raise ApiError(404, "not_found", "Summary template not found")
    return SummaryTemplate.model_validate(row)


@router.delete("/{template_id}", status_code=204)
async def delete_template(
    template_id: str,
    ctx: AuthContext = Depends(get_current_context),
    repo: SummaryTemplatesRepo = Depends(_repo),
) -> None:
    if not await repo.delete(template_id, ctx.workspace.id):
        raise ApiError(404, "not_found", "Summary template not found")
