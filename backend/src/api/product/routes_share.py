"""Per-workspace sharing defaults API (share-link expiry + passcode).

  GET /api/v1/share-settings
  PUT /api/v1/share-settings

These defaults are applied when a meeting is shared publicly: how long the
share link stays live (0 = never), whether a passcode is required, and the
default passcode to seed onto new links.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from ...share_settings import ShareSettingsRepo
from ..database.connection import DatabaseConnection
from .deps import AuthContext, get_current_context, get_db
from .rbac import require_role
from .schemas import ShareSettings

router = APIRouter(prefix="/api/v1/share-settings", tags=["share-settings"])


async def _repo(db: DatabaseConnection = Depends(get_db)) -> ShareSettingsRepo:
    return ShareSettingsRepo(db)


def _to_model(row: dict) -> ShareSettings:
    return ShareSettings(
        default_expiry_hours=int(row.get("default_expiry_hours") or 0),
        require_passcode=bool(row.get("require_passcode")),
        default_passcode=row.get("default_passcode") or "",
    )


@router.get(
    "",
    response_model=ShareSettings,
    summary="Get sharing defaults",
    description=(
        "Returns the workspace's defaults for public meeting share links: "
        "link expiry (hours; 0 = never), whether a passcode is required, and "
        "the default passcode."
    ),
)
async def get_settings(
    ctx: AuthContext = Depends(get_current_context),
    repo: ShareSettingsRepo = Depends(_repo),
) -> ShareSettings:
    return _to_model(await repo.get(ctx.workspace.id))


@router.put(
    "",
    response_model=ShareSettings,
    summary="Update sharing defaults",
    description=(
        "Updates the defaults applied to new public meeting share links: link "
        "expiry (hours; 0 = never), require-passcode toggle, and the default "
        "passcode. Requires the admin role."
    ),
)
async def put_settings(
    body: ShareSettings,
    ctx: AuthContext = Depends(require_role("admin")),
    repo: ShareSettingsRepo = Depends(_repo),
) -> ShareSettings:
    row = await repo.upsert(
        workspace_id=ctx.workspace.id,
        default_expiry_hours=body.default_expiry_hours,
        require_passcode=body.require_passcode,
        default_passcode=body.default_passcode.strip(),
    )
    return _to_model(row)
