"""Retention & compliance API (workspace-scoped).

  GET /api/v1/retention-settings
  PUT /api/v1/retention-settings
  GET /api/v1/export            -> JSON data bundle (GDPR portability)

Deletion runs in the background sweeper; legal hold pauses it. Export is
audit-logged.
"""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, Response

from ...audit import record_audit
from ...compliance import RetentionRepo
from ..database.connection import DatabaseConnection
from .deps import AuthContext, get_current_context, get_db
from .rbac import require_role
from .schemas import RetentionSettings, RetentionSettingsUpdate

router = APIRouter(prefix="/api/v1", tags=["compliance"])


async def _repo(db: DatabaseConnection = Depends(get_db)) -> RetentionRepo:
    return RetentionRepo(db)


def _to_model(row: dict) -> RetentionSettings:
    return RetentionSettings(
        retention_days=row.get("retention_days"),
        legal_hold=bool(row.get("legal_hold")),
    )


@router.get("/retention-settings", response_model=RetentionSettings)
async def get_retention(
    ctx: AuthContext = Depends(get_current_context),
    repo: RetentionRepo = Depends(_repo),
) -> RetentionSettings:
    return _to_model(await repo.get(ctx.workspace.id))


@router.put("/retention-settings", response_model=RetentionSettings)
async def put_retention(
    body: RetentionSettingsUpdate,
    ctx: AuthContext = Depends(require_role("admin")),
    repo: RetentionRepo = Depends(_repo),
    db: DatabaseConnection = Depends(get_db),
) -> RetentionSettings:
    row = await repo.upsert(
        workspace_id=ctx.workspace.id,
        retention_days=body.retention_days,
        legal_hold=body.legal_hold,
    )
    await record_audit(
        db,
        workspace_id=ctx.workspace.id,
        actor_id=ctx.user.id if ctx.user else None,
        action="retention.updated",
        resource_type="workspace",
        resource_id=ctx.workspace.id,
        metadata={"retentionDays": body.retention_days, "legalHold": body.legal_hold},
    )
    return _to_model(row)


@router.get("/export")
async def export_data(
    ctx: AuthContext = Depends(get_current_context),
    repo: RetentionRepo = Depends(_repo),
    db: DatabaseConnection = Depends(get_db),
) -> Response:
    bundle = await repo.export_bundle(ctx.workspace.id)
    await record_audit(
        db,
        workspace_id=ctx.workspace.id,
        actor_id=ctx.user.id if ctx.user else None,
        action="data.exported",
        resource_type="workspace",
        resource_id=ctx.workspace.id,
        metadata={"meetingCount": len(bundle.get("meetings", []))},
    )
    payload = json.dumps(bundle, default=str, indent=2)
    return Response(
        content=payload,
        media_type="application/json",
        headers={
            "Content-Disposition": 'attachment; filename="verdant-export.json"'
        },
    )
