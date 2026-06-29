"""Public, UNAUTHENTICATED read-only meeting recaps via share token.

  GET /api/v1/public/shares/{token}

The token is the only credential (a 256-bit capability URL). This router has no
auth dependency by design. It returns 404 — never 401/403 — for unknown,
revoked or expired tokens so the existence of a meeting can't be probed, and it
leaks no workspace/owner/IDs. Optional sections appear only when the share's
scope flags allow them.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from ...analytics import compute_meeting_analytics
from ...highlights import HighlightsRepo
from ...services.meeting_service import MeetingService
from ...sharing import SharesRepo, is_share_active
from ..database.connection import DatabaseConnection
from .deps import get_db
from .errors import ApiError
from .mappers import insights_from_row, segments_from_transcript, to_meeting
from .meetings_repo import ProductMeetingsRepo
from .schemas import PublicHighlight, PublicMeetingView

router = APIRouter(prefix="/api/v1/public", tags=["public"])

_NOT_FOUND = ApiError(404, "not_found", "This share link is invalid or has expired")


@router.get("/shares/{token}", response_model=PublicMeetingView)
async def get_public_share(
    token: str,
    db: DatabaseConnection = Depends(get_db),
) -> PublicMeetingView:
    shares = SharesRepo(db)
    share = await shares.get_by_token(token)
    if share is None or not is_share_active(
        revoked=bool(share["revoked"]), expires_at=share.get("expires_at")
    ):
        raise _NOT_FOUND

    meeting_id = share["meeting_id"]
    workspace_id = share["workspace_id"]

    meetings = ProductMeetingsRepo(db)
    scoped = await meetings.get_scoped(meeting_id, workspace_id)
    record = await MeetingService(db).get_meeting_by_id(meeting_id)
    if scoped is None or record is None:
        raise _NOT_FOUND

    insights = insights_from_row(scoped.get("insights"))
    base = to_meeting(record, title=scoped.get("title"))
    segments = segments_from_transcript(record.transcript)

    view = PublicMeetingView(
        title=scoped.get("title"),
        summary=insights.summary if insights else "",
        key_points=list(insights.key_points) if insights else [],
        action_items=list(insights.action_items) if insights else [],
        chapters=list(insights.chapters) if insights else [],
        duration_sec=base.duration_sec,
        shared_at=datetime.now(timezone.utc),
    )

    if share["include_transcript"]:
        view.transcript = segments
    if share["include_highlights"]:
        rows = await HighlightsRepo(db).list_for_meeting(meeting_id, workspace_id)
        view.highlights = [PublicHighlight.model_validate(r) for r in rows]
    if share["include_analytics"]:
        view.analytics = compute_meeting_analytics(meeting_id, segments)

    # Best-effort view counter — never gate the response on it.
    try:
        await shares.record_view(token)
    except Exception:  # noqa: BLE001
        pass

    return view
