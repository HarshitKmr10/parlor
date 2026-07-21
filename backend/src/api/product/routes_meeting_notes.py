"""Private, per-user meeting notes API (workspace + user scoped).

  GET /api/v1/meeting-notes/{meeting_id}   (the caller's own note)
  PUT /api/v1/meeting-notes/{meeting_id}   (upsert the caller's own note)

Each note is keyed by (user_id, meeting_id), so only the author ever reads or
writes their own note. Kept under its own prefix so it never touches the
shared meetings routes. Requires a logged-in user — an API-key principal has
no user identity and gets a 403.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from ...meeting_notes import MeetingNotesRepo
from ..database.connection import DatabaseConnection
from .deps import AuthContext, get_current_context, get_db
from .errors import ApiError
from .schemas import MeetingNote, MeetingNoteUpdate

router = APIRouter(prefix="/api/v1/meeting-notes", tags=["meeting-notes"])


async def _repo(db: DatabaseConnection = Depends(get_db)) -> MeetingNotesRepo:
    return MeetingNotesRepo(db)


def _require_user(ctx: AuthContext) -> str:
    if ctx.user is None:
        raise ApiError(403, "user_required", "Personal notes require a logged-in user")
    return ctx.user.id


def _to_model(row: dict) -> MeetingNote:
    return MeetingNote(body=row.get("body") or "", updated_at=row.get("updated_at"))


@router.get(
    "/{meeting_id}",
    response_model=MeetingNote,
    summary="Get your private note for a meeting",
    description=(
        "Returns the caller's own private note for the meeting, defaulting to "
        "an empty note if none exists. Only the author ever sees their note."
    ),
)
async def get_note(
    meeting_id: str,
    ctx: AuthContext = Depends(get_current_context),
    repo: MeetingNotesRepo = Depends(_repo),
) -> MeetingNote:
    user_id = _require_user(ctx)
    row = await repo.get(ctx.workspace.id, user_id, meeting_id)
    return _to_model(row)


@router.put(
    "/{meeting_id}",
    response_model=MeetingNote,
    summary="Update your private note for a meeting",
    description=(
        "Upserts the caller's own private note for the meeting. Only the "
        "author can read or write it; an empty body clears the note."
    ),
)
async def put_note(
    meeting_id: str,
    body: MeetingNoteUpdate,
    ctx: AuthContext = Depends(get_current_context),
    repo: MeetingNotesRepo = Depends(_repo),
) -> MeetingNote:
    user_id = _require_user(ctx)
    row = await repo.upsert(
        workspace_id=ctx.workspace.id,
        user_id=user_id,
        meeting_id=meeting_id,
        body=body.body,
    )
    return _to_model(row)
