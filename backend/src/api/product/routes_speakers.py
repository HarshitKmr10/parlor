"""Speaker identity profiles API (workspace-scoped).

  GET    /api/v1/speaker-profiles
  POST   /api/v1/speaker-profiles
  PATCH  /api/v1/speaker-profiles/{id}
  DELETE /api/v1/speaker-profiles/{id}

Profiles map diarized speaker labels (aliases) to a named person, so analytics
and transcripts resolve "Speaker 1" -> "Alice Chen" across meetings.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from ...speakers import SpeakerProfilesRepo
from ..database.connection import DatabaseConnection
from .deps import AuthContext, get_current_context, get_db
from .errors import ApiError
from .schemas import SpeakerProfile, SpeakerProfileCreate, SpeakerProfileUpdate

router = APIRouter(prefix="/api/v1/speaker-profiles", tags=["speakers"])


async def _repo(db: DatabaseConnection = Depends(get_db)) -> SpeakerProfilesRepo:
    return SpeakerProfilesRepo(db)


def _to_model(row: dict) -> SpeakerProfile:
    return SpeakerProfile(
        id=str(row["id"]),
        display_name=row["display_name"],
        email=row.get("email"),
        aliases=list(row.get("aliases") or []),
    )


def _norm_aliases(aliases) -> list[str]:
    return [str(a).strip() for a in (aliases or []) if str(a).strip()]


@router.get("", response_model=list[SpeakerProfile])
async def list_profiles(
    ctx: AuthContext = Depends(get_current_context),
    repo: SpeakerProfilesRepo = Depends(_repo),
) -> list[SpeakerProfile]:
    return [_to_model(r) for r in await repo.list(ctx.workspace.id)]


@router.post("", response_model=SpeakerProfile, status_code=201)
async def create_profile(
    body: SpeakerProfileCreate,
    ctx: AuthContext = Depends(get_current_context),
    repo: SpeakerProfilesRepo = Depends(_repo),
) -> SpeakerProfile:
    row = await repo.create(
        workspace_id=ctx.workspace.id,
        display_name=body.display_name.strip(),
        email=body.email,
        aliases=_norm_aliases(body.aliases),
    )
    return _to_model(row)


@router.patch("/{profile_id}", response_model=SpeakerProfile)
async def update_profile(
    profile_id: str,
    body: SpeakerProfileUpdate,
    ctx: AuthContext = Depends(get_current_context),
    repo: SpeakerProfilesRepo = Depends(_repo),
) -> SpeakerProfile:
    row = await repo.update(
        profile_id=profile_id,
        workspace_id=ctx.workspace.id,
        display_name=body.display_name.strip() if body.display_name else None,
        email=body.email,
        aliases=_norm_aliases(body.aliases) if body.aliases is not None else None,
    )
    if row is None:
        raise ApiError(404, "not_found", "Speaker profile not found")
    return _to_model(row)


@router.delete("/{profile_id}", status_code=204)
async def delete_profile(
    profile_id: str,
    ctx: AuthContext = Depends(get_current_context),
    repo: SpeakerProfilesRepo = Depends(_repo),
) -> None:
    ok = await repo.delete(profile_id=profile_id, workspace_id=ctx.workspace.id)
    if not ok:
        raise ApiError(404, "not_found", "Speaker profile not found")
