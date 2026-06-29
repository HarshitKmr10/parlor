"""Audit log API (workspace-scoped, admin-oriented).

  GET /api/v1/audit-events

Returns the workspace's recent sensitive actions for security review.
"""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, Query

from ...audit import AuditRepo
from ..database.connection import DatabaseConnection
from .deps import AuthContext, get_current_context, get_db
from .schemas import AuditEvent, AuditEventListResponse

router = APIRouter(prefix="/api/v1/audit-events", tags=["audit"])


async def _repo(db: DatabaseConnection = Depends(get_db)) -> AuditRepo:
    return AuditRepo(db)


def _meta(raw):
    if isinstance(raw, str):
        try:
            return json.loads(raw)
        except (ValueError, TypeError):
            return {}
    return raw or {}


@router.get("", response_model=AuditEventListResponse)
async def list_audit_events(
    limit: int = Query(100, ge=1, le=500),
    ctx: AuthContext = Depends(get_current_context),
    repo: AuditRepo = Depends(_repo),
) -> AuditEventListResponse:
    rows = await repo.list(ctx.workspace.id, limit=limit)
    items = [
        AuditEvent(
            id=str(r["id"]),
            actor_id=str(r["actor_id"]) if r.get("actor_id") else None,
            action=r["action"],
            resource_type=r["resource_type"],
            resource_id=r.get("resource_id"),
            metadata=_meta(r.get("metadata")),
            created_at=r["created_at"],
        )
        for r in rows
    ]
    return AuditEventListResponse(items=items, total=len(items))
