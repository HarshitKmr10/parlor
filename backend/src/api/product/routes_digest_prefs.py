"""Digest preferences API (workspace-scoped).

  GET  /api/v1/digest-preferences
  PUT  /api/v1/digest-preferences
  POST /api/v1/digest-preferences/test   -> build + emit the digest right now

Lets a workspace turn on automatic daily/weekly digest delivery to email or
Slack. The background scheduler reads these rows; "test" bypasses scheduling.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from ...digests import DigestPrefsRepo
from ...digests.build import build_digest
from ...digests.emit import emit_digest
from ...reports import ReportsRepo
from ..database.connection import DatabaseConnection
from .deps import AuthContext, get_current_context, get_db
from .errors import ApiError
from .schemas import DigestPreferences, DigestPreferencesUpdate

router = APIRouter(prefix="/api/v1/digest-preferences", tags=["digests"])


async def _repo(db: DatabaseConnection = Depends(get_db)) -> DigestPrefsRepo:
    return DigestPrefsRepo(db)


def _to_model(row: dict) -> DigestPreferences:
    return DigestPreferences(
        enabled=bool(row["enabled"]),
        frequency=row["frequency"],
        hour_utc=int(row["hour_utc"]),
        day_of_week=int(row["day_of_week"]),
        channel=row["channel"],
        target=row.get("target"),
        last_sent_at=row.get("last_sent_at"),
    )


@router.get(
    "",
    response_model=DigestPreferences,
    summary="Get digest delivery preferences",
    description=(
        "Returns the workspace's automatic digest schedule and delivery "
        "channel (email or Slack), if configured."
    ),
)
async def get_preferences(
    ctx: AuthContext = Depends(get_current_context),
    repo: DigestPrefsRepo = Depends(_repo),
) -> DigestPreferences:
    row = await repo.get(ctx.workspace.id)
    return _to_model(row) if row else DigestPreferences()


@router.put(
    "",
    response_model=DigestPreferences,
    summary="Update digest delivery preferences",
    description=(
        "Enables/disables and configures the automatic daily/weekly digest "
        "(frequency, send hour, channel, target). Read by the background "
        "digest scheduler."
    ),
)
async def put_preferences(
    body: DigestPreferencesUpdate,
    ctx: AuthContext = Depends(get_current_context),
    repo: DigestPrefsRepo = Depends(_repo),
) -> DigestPreferences:
    row = await repo.upsert(
        workspace_id=ctx.workspace.id,
        enabled=body.enabled,
        frequency=body.frequency,
        hour_utc=body.hour_utc,
        day_of_week=body.day_of_week,
        channel=body.channel,
        target=body.target,
    )
    return _to_model(row)


@router.post(
    "/test",
    status_code=200,
    summary="Send a test digest now",
    description=(
        "Builds a digest from current data and emits it immediately to the "
        "configured target, bypassing the scheduler. Requires a delivery "
        "target to already be configured (400 `no_target` otherwise)."
    ),
)
async def send_test(
    ctx: AuthContext = Depends(get_current_context),
    repo: DigestPrefsRepo = Depends(_repo),
    db: DatabaseConnection = Depends(get_db),
) -> dict:
    row = await repo.get(ctx.workspace.id)
    if row is None or not row.get("target"):
        raise ApiError(
            400, "no_target", "Configure a delivery target before sending a test."
        )
    now = datetime.now(timezone.utc)
    digest = await build_digest(ReportsRepo(db), ctx.workspace.id, now)
    result = await emit_digest(row, digest, workspace_name=ctx.workspace.name)
    return result
