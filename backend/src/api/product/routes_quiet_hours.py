"""Per-user notification quiet hours API (workspace + user scoped).

  GET /api/v1/quiet-hours   (the caller's own do-not-notify window)
  PUT /api/v1/quiet-hours   (upsert the caller's own window)

A personal setting keyed by (workspace_id, user_id): a daily window during
which notification/digest emails are suppressed. Requires a logged-in user —
an API-key principal has no user identity and gets a 403.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from ...quiet_hours import QuietHoursRepo
from ..database.connection import DatabaseConnection
from .deps import AuthContext, get_current_context, get_db
from .errors import ApiError
from .schemas import QuietHours

router = APIRouter(prefix="/api/v1/quiet-hours", tags=["quiet-hours"])


async def _repo(db: DatabaseConnection = Depends(get_db)) -> QuietHoursRepo:
    return QuietHoursRepo(db)


def _require_user(ctx: AuthContext) -> str:
    if ctx.user is None:
        raise ApiError(403, "user_required", "Quiet hours require a logged-in user")
    return ctx.user.id


def _to_model(row: dict) -> QuietHours:
    return QuietHours(
        enabled=bool(row.get("enabled")),
        start_hour=int(row.get("start_hour") or 0),
        end_hour=int(row.get("end_hour") or 0),
    )


@router.get(
    "",
    response_model=QuietHours,
    summary="Get your notification quiet hours",
    description=(
        "Returns the caller's own do-not-notify window (whether it is on and "
        "the start/end hour), defaulting to a disabled 20:00–08:00 window if "
        "none is set. Personal to the signed-in user."
    ),
)
async def get_quiet_hours(
    ctx: AuthContext = Depends(get_current_context),
    repo: QuietHoursRepo = Depends(_repo),
) -> QuietHours:
    user_id = _require_user(ctx)
    return _to_model(await repo.get(ctx.workspace.id, user_id))


@router.put(
    "",
    response_model=QuietHours,
    summary="Update your notification quiet hours",
    description=(
        "Upserts the caller's own do-not-notify window: the enabled toggle and "
        "the start/end hour (0–23; the window may wrap past midnight). Personal "
        "to the signed-in user."
    ),
)
async def put_quiet_hours(
    body: QuietHours,
    ctx: AuthContext = Depends(get_current_context),
    repo: QuietHoursRepo = Depends(_repo),
) -> QuietHours:
    user_id = _require_user(ctx)
    row = await repo.upsert(
        workspace_id=ctx.workspace.id,
        user_id=user_id,
        enabled=body.enabled,
        start_hour=body.start_hour,
        end_hour=body.end_hour,
    )
    return _to_model(row)
