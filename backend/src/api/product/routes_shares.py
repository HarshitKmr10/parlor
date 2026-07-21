"""Owner-facing meeting share-link management (workspace-scoped).

  POST   /api/v1/meetings/{meeting_id}/share   create or rotate the link
  GET    /api/v1/meetings/{meeting_id}/share   fetch current link (404 if none)
  DELETE /api/v1/meetings/{meeting_id}/share   revoke (token goes dead)

The public, unauthenticated read view lives in routes_public.py.
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends

from ...share_settings import ShareSettingsRepo
from ...sharing import SharesRepo, generate_share_token
from ..database.connection import DatabaseConnection
from .deps import AuthContext, get_current_context, get_db
from .errors import ApiError
from .meetings_repo import ProductMeetingsRepo
from .schemas import ShareCreateRequest, ShareLink

router = APIRouter(prefix="/api/v1", tags=["sharing"])


async def _repo(db: DatabaseConnection = Depends(get_db)) -> SharesRepo:
    return SharesRepo(db)


async def _settings_repo(
    db: DatabaseConnection = Depends(get_db),
) -> ShareSettingsRepo:
    return ShareSettingsRepo(db)


async def _meetings_repo(
    db: DatabaseConnection = Depends(get_db),
) -> ProductMeetingsRepo:
    return ProductMeetingsRepo(db)


async def _load_share_settings(
    settings: ShareSettingsRepo, workspace_id: str
) -> dict:
    """Workspace sharing defaults (expiry + require-passcode). Defensive: any
    failure loading settings falls back to empty so sharing never breaks."""
    try:
        return dict(await settings.get(workspace_id))
    except Exception:
        return {}


def _share_link(row: dict) -> ShareLink:
    token = row["token"]
    path = f"/share/{token}"
    base = (os.getenv("PUBLIC_APP_URL") or "").rstrip("/")
    return ShareLink(
        meeting_id=str(row["meeting_id"]),
        token=token,
        path=path,
        url=f"{base}{path}" if base else None,
        include_transcript=bool(row["include_transcript"]),
        include_highlights=bool(row["include_highlights"]),
        include_analytics=bool(row["include_analytics"]),
        revoked=bool(row["revoked"]),
        expires_at=row.get("expires_at"),
        has_passcode=bool(row.get("passcode")),
        view_count=int(row.get("view_count") or 0),
        last_viewed_at=row.get("last_viewed_at"),
        created_at=row.get("created_at"),
    )


@router.post(
    "/meetings/{meeting_id}/share",
    response_model=ShareLink,
    status_code=201,
    summary="Create or rotate a meeting share link",
    description=(
        "Creates a public, unauthenticated share link for the meeting, or "
        "rotates the token if one already exists (previous token stops "
        "working). Audit-logged."
    ),
)
async def create_share(
    meeting_id: str,
    body: ShareCreateRequest,
    ctx: AuthContext = Depends(get_current_context),
    repo: SharesRepo = Depends(_repo),
    settings: ShareSettingsRepo = Depends(_settings_repo),
    meetings: ProductMeetingsRepo = Depends(_meetings_repo),
) -> ShareLink:
    if await meetings.get_scoped(meeting_id, ctx.workspace.id) is None:
        raise ApiError(404, "not_found", "Meeting not found in this workspace")

    ws_settings = await _load_share_settings(settings, ctx.workspace.id)

    expires_at: Optional[datetime] = None
    if body.expires_in_days is not None:
        # Explicit caller-provided expiry always wins over the workspace default.
        expires_at = datetime.now(timezone.utc) + timedelta(days=body.expires_in_days)
    else:
        default_hours = int(ws_settings.get("default_expiry_hours") or 0)
        if default_hours > 0:
            expires_at = datetime.now(timezone.utc) + timedelta(hours=default_hours)

    # Explicit caller passcode always wins; otherwise the workspace may require
    # one, in which case its configured default passcode is applied. An empty
    # string (explicit or default) means "no passcode".
    if body.passcode is not None:
        passcode: Optional[str] = body.passcode or None
    elif ws_settings.get("require_passcode"):
        passcode = (ws_settings.get("default_passcode") or "") or None
    else:
        passcode = None

    row = await repo.upsert(
        meeting_id=meeting_id,
        workspace_id=ctx.workspace.id,
        created_by=ctx.user.id if ctx.user else None,
        token=generate_share_token(),
        include_transcript=body.include_transcript,
        include_highlights=body.include_highlights,
        include_analytics=body.include_analytics,
        expires_at=expires_at,
        passcode=passcode,
    )
    from ...audit import record_audit

    await record_audit(
        repo._db,
        workspace_id=ctx.workspace.id,
        actor_id=ctx.user.id if ctx.user else None,
        action="share.created",
        resource_type="meeting",
        resource_id=meeting_id,
        metadata={"includeTranscript": body.include_transcript},
    )
    return _share_link(row)


@router.get(
    "/meetings/{meeting_id}/share",
    response_model=ShareLink,
    summary="Get the current meeting share link",
    description="Returns the meeting's active share link and view stats. 404 if none exists.",
)
async def get_share(
    meeting_id: str,
    ctx: AuthContext = Depends(get_current_context),
    repo: SharesRepo = Depends(_repo),
) -> ShareLink:
    row = await repo.get_for_meeting(meeting_id, ctx.workspace.id)
    if row is None:
        raise ApiError(404, "not_found", "This meeting has no share link")
    return _share_link(row)


@router.delete(
    "/meetings/{meeting_id}/share",
    status_code=204,
    summary="Revoke a meeting share link",
    description="Revokes the meeting's share link so its token stops working. Audit-logged. 404 if none exists.",
)
async def revoke_share(
    meeting_id: str,
    ctx: AuthContext = Depends(get_current_context),
    repo: SharesRepo = Depends(_repo),
) -> None:
    if not await repo.revoke(meeting_id, ctx.workspace.id):
        raise ApiError(404, "not_found", "This meeting has no share link")
    from ...audit import record_audit

    await record_audit(
        repo._db,
        workspace_id=ctx.workspace.id,
        actor_id=ctx.user.id if ctx.user else None,
        action="share.revoked",
        resource_type="meeting",
        resource_id=meeting_id,
    )
