"""/api/v1/meetings/* product router (workspace-scoped)."""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect

from shared.exceptions import InvalidMeetingURLError

from ...services.meeting_service import MeetingService
from ...shared.platformDetector import PlatformDetector
from ..database.connection import DatabaseConnection, get_db_connection
from ..models.schemas import MeetingStatus as InternalStatus
from . import ai_client
from .deps import AuthContext, get_current_context, get_current_workspace, get_db
from .errors import ApiError
from .mappers import (
    insights_from_row,
    segments_from_transcript,
    to_meeting,
)
from .meetings_repo import ProductMeetingsRepo
from .schemas import (
    AskRequest,
    AskResponse,
    Citation,
    Meeting,
    MeetingCreateRequest,
    MeetingInsights,
    MeetingListResponse,
    MeetingWithInsights,
    TranscriptResponse,
    Workspace,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/meetings", tags=["meetings"])

_VALID_STATUSES = {"scheduled", "joining", "ongoing", "completed", "failed"}
# Internal joiner platform tokens we accept on create.
_SUPPORTED_PLATFORMS = {"msteams", "googlemeet", "zoom"}


async def _service(db: DatabaseConnection = Depends(get_db)) -> MeetingService:
    return MeetingService(db)


async def _repo(db: DatabaseConnection = Depends(get_db)) -> ProductMeetingsRepo:
    return ProductMeetingsRepo(db)


async def _load_scoped_meeting(
    meeting_id: str,
    workspace_id: str,
    service: MeetingService,
    repo: ProductMeetingsRepo,
):
    """Fetch a meeting and assert it belongs to the workspace. 404 otherwise."""
    scoped = await repo.get_scoped(meeting_id, workspace_id)
    if scoped is None:
        raise ApiError(404, "not_found", "Meeting not found in this workspace")
    record = await service.get_meeting_by_id(meeting_id)
    if record is None:
        raise ApiError(404, "not_found", "Meeting not found")
    return record, scoped


@router.get("", response_model=MeetingListResponse)
async def list_meetings(
    status: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    workspace: Workspace = Depends(get_current_workspace),
    service: MeetingService = Depends(_service),
    repo: ProductMeetingsRepo = Depends(_repo),
) -> MeetingListResponse:
    statuses: Optional[list[str]] = None
    if status:
        requested = [s.strip() for s in status.split(",") if s.strip()]
        unknown = [s for s in requested if s not in _VALID_STATUSES]
        if unknown:
            raise ApiError(
                400, "invalid_status", f"Unknown status values: {unknown}"
            )
        statuses = requested

    ids = await repo.list_ids(
        workspace_id=workspace.id, statuses=statuses, limit=limit, offset=offset
    )
    total = await repo.count(workspace_id=workspace.id, statuses=statuses)

    items: list[Meeting] = []
    for mid in ids:
        record = await service.get_meeting_by_id(mid)
        if record is None:
            continue
        scoped = await repo.get_scoped(mid, workspace.id)
        title = scoped.get("title") if scoped else None
        m = to_meeting(record, title=title)
        m.workspace_id = workspace.id
        items.append(m)

    return MeetingListResponse(items=items, total=total, limit=limit, offset=offset)


@router.post("", response_model=Meeting, status_code=201)
async def create_meeting(
    body: MeetingCreateRequest,
    workspace: Workspace = Depends(get_current_workspace),
    service: MeetingService = Depends(_service),
    repo: ProductMeetingsRepo = Depends(_repo),
) -> Meeting:
    platform = PlatformDetector.detect_platform(body.meeting_url)
    if platform == "unknown" or not PlatformDetector.is_supported(platform):
        raise ApiError(
            400, "invalid_meeting_url", "Unrecognized or unsupported meeting URL"
        )
    try:
        record = await service.create_meeting(
            meeting_url=body.meeting_url,
            org_id=None,
            bot_name=body.bot_name,
            transcript_source=None,
            scheduled_at=body.scheduled_at,
        )
    except InvalidMeetingURLError as exc:
        raise ApiError(400, "invalid_meeting_url", str(exc))

    await repo.set_workspace(record.id, workspace.id)
    if body.title:
        await repo.set_title(record.id, body.title)

    # Dispatch via the existing joiner internals. The shared dispatch path
    # lives in main.dispatch_meeting; import lazily to avoid a circular import
    # at module load. Dispatch failures are non-fatal to the create response —
    # the meeting row exists and the scheduler/queue can pick it up.
    if record.scheduled_at is None:
        try:
            from ...main import dispatch_meeting, get_queue_service  # noqa: PLC0415

            queue_service = await get_queue_service()
            await dispatch_meeting(
                meeting_id=str(record.id),
                meeting_url=body.meeting_url,
                platform=platform,
                transcript_source=None,
                bot_name=body.bot_name,
                org_id=None,
                meeting_service=service,
                queue_service=queue_service,
                allow_on_demand=False,
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("Dispatch for meeting %s deferred: %s", record.id, exc)

    refreshed = await service.get_meeting_by_id(record.id) or record
    meeting = to_meeting(refreshed, title=body.title)
    meeting.workspace_id = workspace.id
    return meeting


@router.get("/{meeting_id}", response_model=MeetingWithInsights)
async def get_meeting(
    meeting_id: str,
    workspace: Workspace = Depends(get_current_workspace),
    service: MeetingService = Depends(_service),
    repo: ProductMeetingsRepo = Depends(_repo),
) -> MeetingWithInsights:
    record, scoped = await _load_scoped_meeting(
        meeting_id, workspace.id, service, repo
    )
    base = to_meeting(record, title=scoped.get("title"))
    insights = insights_from_row(scoped.get("insights"))
    result = MeetingWithInsights(**base.model_dump(), insights=insights)
    result.workspace_id = workspace.id
    result.has_summary = result.has_summary or insights is not None
    return result


@router.get("/{meeting_id}/transcript", response_model=TranscriptResponse)
async def get_transcript(
    meeting_id: str,
    since: Optional[str] = Query(None),
    workspace: Workspace = Depends(get_current_workspace),
    service: MeetingService = Depends(_service),
    repo: ProductMeetingsRepo = Depends(_repo),
) -> TranscriptResponse:
    record, _ = await _load_scoped_meeting(meeting_id, workspace.id, service, repo)
    segments = segments_from_transcript(record.transcript)

    if since:
        try:
            from datetime import datetime

            cutoff = datetime.fromisoformat(since.replace("Z", "+00:00"))
            segments = [
                s
                for s in segments
                if s.created_at is not None and s.created_at > cutoff
            ]
        except ValueError:
            raise ApiError(400, "invalid_since", "since must be an ISO-8601 timestamp")

    last_at = segments[-1].created_at if segments else None
    return TranscriptResponse(items=segments, last_segment_at=last_at)


@router.delete("/{meeting_id}", response_model=Meeting)
async def stop_meeting(
    meeting_id: str,
    workspace: Workspace = Depends(get_current_workspace),
    service: MeetingService = Depends(_service),
    repo: ProductMeetingsRepo = Depends(_repo),
) -> Meeting:
    record, scoped = await _load_scoped_meeting(
        meeting_id, workspace.id, service, repo
    )
    if record.status.value not in ("completed", "failed"):
        await service.update_meeting_status(meeting_id, InternalStatus.COMPLETED)
    refreshed = await service.get_meeting_by_id(meeting_id) or record
    meeting = to_meeting(refreshed, title=scoped.get("title"))
    meeting.workspace_id = workspace.id
    return meeting


@router.post("/{meeting_id}/summarize", response_model=MeetingInsights)
async def summarize_meeting(
    meeting_id: str,
    workspace: Workspace = Depends(get_current_workspace),
    service: MeetingService = Depends(_service),
    repo: ProductMeetingsRepo = Depends(_repo),
) -> MeetingInsights:
    record, scoped = await _load_scoped_meeting(
        meeting_id, workspace.id, service, repo
    )
    segments = [s.model_dump(by_alias=True) for s in segments_from_transcript(record.transcript)]
    payload = {
        "meetingId": meeting_id,
        "meta": {
            "title": scoped.get("title") or "",
            "participants": [
                p.model_dump(by_alias=True)
                for p in to_meeting(record).participants
            ],
        },
        "segments": segments,
    }
    data = await ai_client.summarize(payload)
    insights = MeetingInsights.model_validate(data)
    # Persist for later GET /{id}.
    await repo.store_insights(
        meeting_id, json.dumps(insights.model_dump(by_alias=True))
    )
    return insights


@router.post("/{meeting_id}/ask", response_model=AskResponse)
async def ask_meeting(
    meeting_id: str,
    body: AskRequest,
    workspace: Workspace = Depends(get_current_workspace),
    service: MeetingService = Depends(_service),
    repo: ProductMeetingsRepo = Depends(_repo),
) -> AskResponse:
    await _load_scoped_meeting(meeting_id, workspace.id, service, repo)
    payload = {
        "workspaceId": workspace.id,
        "meetingId": meeting_id,
        "question": body.question,
        "history": body.history or [],
    }
    data = await ai_client.chat(payload)
    citations = [
        Citation.model_validate(c)
        for c in (data.get("citations") or [])
        if isinstance(c, dict)
    ]
    return AskResponse(answer=str(data.get("answer", "")), citations=citations)


# ── WebSocket live stream ────────────────────────────────────────────────
_POLL_INTERVAL_SEC = 1.0


@router.websocket("/{meeting_id}/live")
async def live_stream(websocket: WebSocket, meeting_id: str) -> None:
    """Stream new transcript segments + status by polling the DB transcript.

    Auth: the dashboard connects with ?token=<accessToken>&workspaceId=<id>
    query params (browsers can't set headers on WS). The token is validated and
    workspace membership checked before the socket is accepted.
    """
    token = websocket.query_params.get("token")
    workspace_id = websocket.query_params.get("workspaceId")
    if not token or not workspace_id:
        await websocket.close(code=4401)
        return

    db = await get_db_connection()
    from .repository import AuthRepository  # noqa: PLC0415
    from .security import decode_access_token  # noqa: PLC0415

    auth_repo = AuthRepository(db)
    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub")
        membership = await auth_repo.get_membership(
            workspace_id=workspace_id, user_id=user_id
        )
    except Exception:  # noqa: BLE001
        membership = None
    if not membership:
        await websocket.close(code=4401)
        return

    service = MeetingService(db)
    repo = ProductMeetingsRepo(db)
    scoped = await repo.get_scoped(meeting_id, workspace_id)
    if scoped is None:
        await websocket.close(code=4404)
        return

    await websocket.accept()
    seen = 0
    last_status: Optional[str] = None
    try:
        while True:
            record = await service.get_meeting_by_id(meeting_id)
            if record is None:
                await websocket.close(code=4404)
                return

            if record.status.value != last_status:
                last_status = record.status.value
                await websocket.send_json(
                    {"type": "status", "status": to_meeting(record).status}
                )

            segments = segments_from_transcript(record.transcript)
            if len(segments) > seen:
                for seg in segments[seen:]:
                    await websocket.send_json(
                        {"type": "segment", "segment": seg.model_dump(by_alias=True, mode="json")}
                    )
                seen = len(segments)

            if record.status.value in ("completed", "failed"):
                # Final flush done; close gracefully.
                await websocket.close(code=1000)
                return

            await asyncio.sleep(_POLL_INTERVAL_SEC)
    except WebSocketDisconnect:
        return
    except Exception as exc:  # noqa: BLE001
        logger.warning("live_stream error for %s: %s", meeting_id, exc)
        try:
            await websocket.close(code=1011)
        except Exception:  # noqa: BLE001
            pass
