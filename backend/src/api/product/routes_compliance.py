"""Retention & compliance API (workspace-scoped).

  GET  /api/v1/retention-settings
  PUT  /api/v1/retention-settings
  GET  /api/v1/export                          -> JSON data bundle (GDPR portability)
  POST /api/v1/meetings/{meeting_id}/restore   -> undo a retention soft-delete

Deletion runs in the background sweeper as a two-phase soft-delete then
hard-delete (see ``services/retention_sweeper.py``); legal hold pauses both
phases. Restore only works inside the tombstone recovery window -- once a
meeting is hard-deleted it's gone for good. Export and restore are
audit-logged.
"""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, Response

from ...audit import record_audit
from ...compliance import RetentionRepo
from ..database.connection import DatabaseConnection
from .deps import AuthContext, get_current_context, get_db
from .errors import ApiError
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


@router.get(
    "/retention-settings",
    response_model=RetentionSettings,
    summary="Get retention settings",
    description="Returns the workspace's retention window (days) and legal-hold flag.",
)
async def get_retention(
    ctx: AuthContext = Depends(get_current_context),
    repo: RetentionRepo = Depends(_repo),
) -> RetentionSettings:
    return _to_model(await repo.get(ctx.workspace.id))


@router.put(
    "/retention-settings",
    response_model=RetentionSettings,
    summary="Update retention settings",
    description=(
        "Sets the retention window (days) and/or legal-hold flag for the "
        "workspace; legal hold pauses the background soft-delete/hard-"
        "delete sweeper entirely. Audit-logged. Requires the admin role."
    ),
)
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


@router.get(
    "/export",
    summary="Export workspace data (GDPR portability)",
    description=(
        "Streams a full JSON data bundle for the workspace (meetings, "
        "transcripts, insights) as a file download, excluding soft-deleted "
        "meetings. Audit-logged. Requires the admin role."
    ),
)
async def export_data(
    ctx: AuthContext = Depends(require_role("admin")),
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
            "Content-Disposition": 'attachment; filename="parlor-export.json"'
        },
    )


@router.post(
    "/meetings/{meeting_id}/restore",
    summary="Restore a soft-deleted meeting",
    description=(
        "Undoes a retention soft-delete, un-hiding the meeting from search, "
        "list, reports, and Ask. 404 if the meeting was never soft-deleted "
        "or has already passed the tombstone window and been hard-deleted. "
        "Audit-logged. Requires the admin role."
    ),
)
async def restore_meeting(
    meeting_id: str,
    ctx: AuthContext = Depends(require_role("admin")),
    repo: RetentionRepo = Depends(_repo),
    db: DatabaseConnection = Depends(get_db),
) -> Response:
    restored = await repo.restore_meeting(meeting_id, ctx.workspace.id)
    if not restored:
        raise ApiError(
            404,
            "not_found",
            "Meeting not found in the recovery window for this workspace",
        )
    await record_audit(
        db,
        workspace_id=ctx.workspace.id,
        actor_id=ctx.user.id if ctx.user else None,
        action="meeting.restored",
        resource_type="meeting",
        resource_id=meeting_id,
    )
    return Response(status_code=204)
