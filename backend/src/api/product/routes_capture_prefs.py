"""Per-workspace auto-join preferences API (calendar capture).

  GET /api/v1/capture-prefs
  PUT /api/v1/capture-prefs

These preferences control how Parlor auto-joins meetings from connected
calendars: a master auto-join switch, how many minutes ahead to join, and
per-platform toggles (Zoom / Google Meet / Microsoft Teams). The calendar
poller consults them before dispatching a bot for an upcoming event.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from ...capture_prefs import CapturePrefsRepo
from ..database.connection import DatabaseConnection
from .deps import AuthContext, get_current_context, get_db
from .rbac import require_role
from .schemas import CapturePrefs

router = APIRouter(prefix="/api/v1/capture-prefs", tags=["capture-prefs"])


async def _repo(db: DatabaseConnection = Depends(get_db)) -> CapturePrefsRepo:
    return CapturePrefsRepo(db)


def _to_model(row: dict) -> CapturePrefs:
    return CapturePrefs(
        auto_join_enabled=bool(row.get("auto_join_enabled")),
        join_lead_minutes=int(row.get("join_lead_minutes") or 0),
        join_zoom=bool(row.get("join_zoom")),
        join_meet=bool(row.get("join_meet")),
        join_teams=bool(row.get("join_teams")),
    )


@router.get(
    "",
    response_model=CapturePrefs,
    summary="Get auto-join preferences",
    description=(
        "Returns the workspace's auto-join preferences: the master auto-join "
        "switch, join lead time (minutes), and the per-platform toggles for "
        "Zoom, Google Meet, and Microsoft Teams."
    ),
)
async def get_prefs(
    ctx: AuthContext = Depends(get_current_context),
    repo: CapturePrefsRepo = Depends(_repo),
) -> CapturePrefs:
    return _to_model(await repo.get(ctx.workspace.id))


@router.put(
    "",
    response_model=CapturePrefs,
    summary="Update auto-join preferences",
    description=(
        "Updates the workspace's auto-join preferences: the master auto-join "
        "switch, join lead time (0–30 minutes), and the per-platform toggles "
        "for Zoom, Google Meet, and Microsoft Teams. Requires the admin role."
    ),
)
async def put_prefs(
    body: CapturePrefs,
    ctx: AuthContext = Depends(require_role("admin")),
    repo: CapturePrefsRepo = Depends(_repo),
) -> CapturePrefs:
    row = await repo.upsert(
        workspace_id=ctx.workspace.id,
        auto_join_enabled=body.auto_join_enabled,
        join_lead_minutes=body.join_lead_minutes,
        join_zoom=body.join_zoom,
        join_meet=body.join_meet,
        join_teams=body.join_teams,
    )
    return _to_model(row)
