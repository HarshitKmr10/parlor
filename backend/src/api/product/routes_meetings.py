"""/api/v1/meetings/* product router (workspace-scoped)."""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request, Response, WebSocket, WebSocketDisconnect

from shared.exceptions import InvalidMeetingURLError

from ...analytics import compute_meeting_analytics
from ...quota import enforce_cost_cap, enforce_meeting_quota
from ...services.meeting_service import MeetingService
from ...shared.platformDetector import PlatformDetector
from ...usage import capture_llm_usage
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
from .meeting_export import build_meeting_markdown, markdown_filename
from .meetings_repo import ProductMeetingsRepo
from .rbac import require_role
from .schemas import (
    AskRequest,
    AskResponse,
    BotlessCreateRequest,
    Citation,
    Meeting,
    CoachingScorecard,
    MeetingAnalytics,
    MeetingAssist,
    MeetingCreateRequest,
    MeetingInsights,
    MeetingListResponse,
    MeetingWithInsights,
    TranscriptIngestRequest,
    TranscriptIngestResponse,
    TranscriptResponse,
    Workspace,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/meetings", tags=["meetings"])

_VALID_STATUSES = {"scheduled", "joining", "ongoing", "completed", "failed"}
# Internal joiner platform tokens we accept on create.
_SUPPORTED_PLATFORMS = {"msteams", "googlemeet", "zoom"}

# /assist is polled every ~20s while a meeting is live. Sending the whole
# growing transcript on every poll re-serializes and re-transmits an
# ever-larger payload; window it to the most recent segments, mirroring the
# `history[-6:]` windowing ai-service/app/rag/chat.py uses for chat history.
_ASSIST_WINDOW_SEGMENTS = 40


def _fire_completion_pipeline(meeting_id: str) -> None:
    """Kick the embed→summarize→recap pipeline as a background task.

    Imported lazily to avoid a circular import at module load. Tolerates the
    pipeline being unavailable — the meeting still completes, and the user can
    trigger ``POST /{id}/summarize`` manually.
    """
    try:
        from ...services.completion_pipeline import (  # noqa: PLC0415
            run_completion_pipeline,
        )

        asyncio.create_task(
            run_completion_pipeline(meeting_id),
            name=f"completion-pipeline-{meeting_id}",
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "completion_pipeline_skipped meeting=%s error=%s", meeting_id, exc
        )


async def _service(db: DatabaseConnection = Depends(get_db)) -> MeetingService:
    return MeetingService(db)


async def _repo(db: DatabaseConnection = Depends(get_db)) -> ProductMeetingsRepo:
    return ProductMeetingsRepo(db)


async def _resolve_template_meta(db, workspace_id: str, template_id: Optional[str]):
    """Resolve the summarizer template meta from an explicit id or the default.

    Returns None (no template) on any miss — summarization must never fail just
    because a template was deleted or the table is unavailable.
    """
    try:
        from ...summary_templates import SummaryTemplatesRepo, template_to_meta

        repo = SummaryTemplatesRepo(db)
        row = (
            await repo.get(template_id, workspace_id)
            if template_id
            else await repo.get_default(workspace_id)
        )
        if template_id and row is None:
            raise ApiError(404, "not_found", "Summary template not found")
        return template_to_meta(row)
    except ApiError:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.warning("summary_template_resolve_failed: %s", exc)
        return None


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


@router.get(
    "",
    response_model=MeetingListResponse,
    summary="List meetings",
    description=(
        "Returns the workspace's meetings, optionally filtered by a comma-"
        "separated `status` list. Excludes meetings soft-deleted by the "
        "retention sweeper — use `/deleted` to see those."
    ),
)
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
            raise ApiError(400, "invalid_status", f"Unknown status values: {unknown}")
        statuses = requested

    ids = await repo.list_ids(
        workspace_id=workspace.id, statuses=statuses, limit=limit, offset=offset
    )
    total = await repo.count(workspace_id=workspace.id, statuses=statuses)

    records = await service.get_meetings_by_ids(ids)
    records_by_id = {record.id: record for record in records}
    scoped_by_id = await repo.get_scoped_many(ids, workspace.id)

    items: list[Meeting] = []
    for mid in ids:
        record = records_by_id.get(mid)
        if record is None:
            continue
        scoped = scoped_by_id.get(mid)
        title = scoped.get("title") if scoped else None
        m = to_meeting(record, title=title)
        m.workspace_id = workspace.id
        items.append(m)

    return MeetingListResponse(items=items, total=total, limit=limit, offset=offset)


@router.get(
    "/deleted",
    response_model=MeetingListResponse,
    summary="List soft-deleted meetings",
    description=(
        "Soft-deleted-but-not-yet-hard-deleted meetings, for an admin to "
        "find and restore. Only meetings still inside the "
        "`RETENTION_TOMBSTONE_DAYS` recovery window are returned — once "
        "hard-deleted, a meeting is gone for good. Requires the admin role."
    ),
)
async def list_deleted_meetings(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    ctx: AuthContext = Depends(require_role("admin")),
    service: MeetingService = Depends(_service),
    repo: ProductMeetingsRepo = Depends(_repo),
) -> MeetingListResponse:
    workspace = ctx.workspace
    ids = await repo.list_ids(
        workspace_id=workspace.id,
        statuses=None,
        limit=limit,
        offset=offset,
        deleted=True,
    )
    total = await repo.count(workspace_id=workspace.id, statuses=None, deleted=True)

    records = await service.get_meetings_by_ids(ids)
    records_by_id = {record.id: record for record in records}
    scoped_by_id = await repo.get_scoped_any_many(ids, workspace.id)

    items: list[Meeting] = []
    for mid in ids:
        record = records_by_id.get(mid)
        if record is None:
            continue
        scoped = scoped_by_id.get(mid)
        title = scoped.get("title") if scoped else None
        m = to_meeting(record, title=title)
        m.workspace_id = workspace.id
        items.append(m)

    return MeetingListResponse(items=items, total=total, limit=limit, offset=offset)


@router.post(
    "",
    response_model=Meeting,
    status_code=201,
    summary="Create a meeting and dispatch a bot",
    description=(
        "Creates a workspace-scoped meeting from a Zoom/Meet/Teams URL and "
        "dispatches a bot to join it via the existing joiner infrastructure "
        "(immediately, or at `scheduledAt` if set). Dispatch failures are "
        "non-fatal to this response — the meeting row still exists and can "
        "be picked up by the scheduler/queue. 400 `invalid_meeting_url` for "
        "an unrecognized or unsupported URL. Subject to the workspace's "
        "meeting quota."
    ),
)
async def create_meeting(
    body: MeetingCreateRequest,
    workspace: Workspace = Depends(get_current_workspace),
    service: MeetingService = Depends(_service),
    repo: ProductMeetingsRepo = Depends(_repo),
    db: DatabaseConnection = Depends(get_db),
) -> Meeting:
    await enforce_meeting_quota(db, workspace.id)

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


@router.post(
    "/botless",
    response_model=Meeting,
    status_code=201,
    summary="Create a botless (desktop-capture) meeting",
    description=(
        "Creates a workspace-scoped meeting WITHOUT dispatching a bot, for "
        "the desktop-capture client: audio is captured and transcribed "
        "client-side, then segments are pushed via `POST /{id}/transcript`. "
        "The meeting gets a synthetic `desktop://<workspaceId>/<timestamp>` "
        "URL, `platform: 'desktop'`, starts `ongoing`, and has no bot name. "
        "Subject to the workspace's meeting quota."
    ),
    responses={
        201: {
            "content": {
                "application/json": {
                    "example": {
                        "id": "3f9c2b1a-4d5e-4f6a-8b7c-9d0e1f2a3b4c",
                        "workspaceId": "c9bf9e57-1685-4c89-bafb-ff5af830be8a",
                        "title": "Weekly sync",
                        "platform": "desktop",
                        "meetingUrl": "desktop://c9bf9e57-1685-4c89-bafb-ff5af830be8a/20260115T093000000000Z",
                        "status": "ongoing",
                        "participants": [],
                        "hasSummary": False,
                        "hasRecording": False,
                        "createdAt": "2026-01-15T09:30:00Z",
                    }
                }
            }
        }
    },
)
async def create_botless_meeting(
    body: BotlessCreateRequest,
    workspace: Workspace = Depends(get_current_workspace),
    service: MeetingService = Depends(_service),
    repo: ProductMeetingsRepo = Depends(_repo),
    db: DatabaseConnection = Depends(get_db),
) -> Meeting:
    await enforce_meeting_quota(db, workspace.id)

    from datetime import datetime, timezone  # noqa: PLC0415

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    synthetic_url = f"desktop://{workspace.id}/{stamp}"

    record = await service.create_meeting(
        meeting_url=synthetic_url,
        org_id=None,
        bot_name=None,
        transcript_source=None,
        scheduled_at=None,
    )

    await repo.set_workspace(record.id, workspace.id)
    if body.title:
        await repo.set_title(record.id, body.title)

    # No bot dispatch. Move straight to "ongoing" so the live/transcript paths
    # treat this like an in-progress meeting receiving segments.
    await service.update_meeting_status(record.id, InternalStatus.ONGOING)

    refreshed = await service.get_meeting_by_id(record.id) or record
    meeting = to_meeting(refreshed, title=body.title)
    meeting.workspace_id = workspace.id
    return meeting


@router.post(
    "/{meeting_id}/transcript",
    response_model=TranscriptIngestResponse,
    summary="Append transcript segments",
    description=(
        "Appends externally-captured transcript segments to a meeting "
        "(used by desktop-capture and native-capture ingestion), reusing "
        "the same internal path the bot uses so the transcript JSON, "
        "segment count, and last-segment time stay consistent. Segments "
        "are appended in `tStartSec` order; out-of-order or missing "
        "`createdAt` timestamps are clamped so the `since` cursor used by "
        "polling and the live WebSocket never regresses."
    ),
    responses={
        200: {
            "content": {
                "application/json": {
                    "example": {
                        "appended": 3,
                        "lastSegmentAt": "2026-01-15T09:34:12Z",
                    }
                }
            }
        }
    },
)
async def ingest_transcript(
    meeting_id: str,
    body: TranscriptIngestRequest,
    workspace: Workspace = Depends(get_current_workspace),
    service: MeetingService = Depends(_service),
    repo: ProductMeetingsRepo = Depends(_repo),
) -> TranscriptIngestResponse:
    record, _ = await _load_scoped_meeting(meeting_id, workspace.id, service, repo)

    from datetime import datetime, timezone  # noqa: PLC0415

    # Determine the latest existing segment timestamp so newly-appended
    # segments never carry an earlier "timestamp" (which would break `since`).
    existing = segments_from_transcript(record.transcript)
    floor: Optional[datetime] = existing[-1].created_at if existing else None

    # Append in start-time order for stable transcript ordering.
    incoming = sorted(body.segments, key=lambda s: s.t_start_sec)

    appended = 0
    last_at: Optional[datetime] = floor
    for seg in incoming:
        ts = seg.created_at
        if ts is None:
            ts = datetime.now(timezone.utc)
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        # Clamp out-of-order timestamps so the monotonic `since` cursor holds.
        if last_at is not None and ts <= last_at:
            ts = last_at
        content_item = {
            "id": seg.id,
            "speaker": seg.speaker_name,
            "speakerId": seg.speaker_id,
            "text": seg.text,
            "startTime": seg.t_start_sec,
            "endTime": seg.t_end_sec,
            "timestamp": ts.isoformat(),
        }
        result = await service.append_transcript_segment(meeting_id, content_item)
        if result is not None:
            appended += 1
            last_at = ts

    if appended == 0:
        raise ApiError(500, "ingest_failed", "No transcript segments could be appended")

    return TranscriptIngestResponse(appended=appended, last_segment_at=last_at)


@router.post(
    "/{meeting_id}/capture/{provider}",
    response_model=TranscriptIngestResponse,
    summary="Ingest a platform-native transcript",
    description=(
        "Botless native capture: ingests a platform-native transcript "
        "(e.g. Zoom/Teams cloud recording JSON, or WebVTT for `provider=vtt`) "
        "without a bot joining. The payload is normalized to internal "
        "segments and appended via the same path as bot/botless capture. "
        "400 `unsupported_provider`/`invalid_payload`/`empty_transcript` on "
        "bad input."
    ),
)
async def capture_native(
    meeting_id: str,
    provider: str,
    request: Request,
    workspace: Workspace = Depends(get_current_workspace),
    service: MeetingService = Depends(_service),
    repo: ProductMeetingsRepo = Depends(_repo),
) -> TranscriptIngestResponse:
    from ...capture import normalize  # noqa: PLC0415

    raw = await request.body()
    p = provider.lower()
    if p == "vtt":
        payload: Any = raw.decode("utf-8", errors="replace")
    else:
        try:
            payload = json.loads(raw or b"{}")
        except ValueError:
            raise ApiError(400, "invalid_payload", "Body must be valid JSON")
    try:
        normalized = normalize(p, payload)
    except ValueError as exc:
        raise ApiError(400, "unsupported_provider", str(exc))
    if not normalized:
        raise ApiError(400, "empty_transcript", "No segments found in the payload")

    from .schemas import TranscriptSegment as _TS  # noqa: PLC0415

    segments = [
        _TS(
            id=s["id"],
            speaker_id=s.get("speakerId"),
            speaker_name=s["speakerName"],
            text=s["text"],
            t_start_sec=s["tStartSec"],
            t_end_sec=s["tEndSec"],
        )
        for s in normalized
    ]
    return await ingest_transcript(
        meeting_id, TranscriptIngestRequest(segments=segments), workspace, service, repo
    )


@router.post(
    "/{meeting_id}/complete",
    response_model=Meeting,
    summary="Complete a meeting",
    description=(
        "Finalizes a meeting (`ongoing` → `completed`) and fires the "
        "embed→summarize→recap pipeline. Used by botless desktop-capture "
        "to end a session. Idempotent — a no-op returning the current "
        "state if the meeting is already terminal. Uses a guarded "
        "conditional update so two concurrent finalize requests can't both "
        "trigger the pipeline."
    ),
    responses={
        200: {
            "content": {
                "application/json": {
                    "example": {
                        "id": "3f9c2b1a-4d5e-4f6a-8b7c-9d0e1f2a3b4c",
                        "workspaceId": "c9bf9e57-1685-4c89-bafb-ff5af830be8a",
                        "title": "Weekly sync",
                        "platform": "desktop",
                        "meetingUrl": "desktop://c9bf9e57-1685-4c89-bafb-ff5af830be8a/20260115T093000000000Z",
                        "status": "completed",
                        "startedAt": "2026-01-15T09:30:00Z",
                        "endedAt": "2026-01-15T10:02:00Z",
                        "durationSec": 1920,
                        "participants": [],
                        "hasSummary": False,
                        "hasRecording": False,
                        "createdAt": "2026-01-15T09:30:00Z",
                    }
                }
            }
        }
    },
)
async def complete_meeting(
    meeting_id: str,
    workspace: Workspace = Depends(get_current_workspace),
    service: MeetingService = Depends(_service),
    repo: ProductMeetingsRepo = Depends(_repo),
) -> Meeting:
    record, scoped = await _load_scoped_meeting(meeting_id, workspace.id, service, repo)
    if record.status.value not in ("completed", "failed"):
        if await service.complete_if_active(meeting_id):
            _fire_completion_pipeline(meeting_id)
    refreshed = await service.get_meeting_by_id(meeting_id) or record
    meeting = to_meeting(refreshed, title=scoped.get("title"))
    meeting.workspace_id = workspace.id
    return meeting


@router.get(
    "/{meeting_id}",
    response_model=MeetingWithInsights,
    summary="Get a meeting",
    description="Returns a single meeting with its AI insights (summary, key points, action items, chapters), if available. 404 if not found in this workspace.",
)
async def get_meeting(
    meeting_id: str,
    workspace: Workspace = Depends(get_current_workspace),
    service: MeetingService = Depends(_service),
    repo: ProductMeetingsRepo = Depends(_repo),
) -> MeetingWithInsights:
    record, scoped = await _load_scoped_meeting(meeting_id, workspace.id, service, repo)
    base = to_meeting(record, title=scoped.get("title"))
    insights = insights_from_row(scoped.get("insights"))
    result = MeetingWithInsights(**base.model_dump(), insights=insights)
    result.workspace_id = workspace.id
    result.has_summary = result.has_summary or insights is not None
    return result


@router.get(
    "/{meeting_id}/transcript",
    response_model=TranscriptResponse,
    summary="Get a meeting's transcript",
    description=(
        "Returns transcript segments for a meeting, optionally only those "
        "after an ISO-8601 `since` cursor (for incremental polling). 400 "
        "`invalid_since` if `since` isn't a valid timestamp."
    ),
)
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


_SUPPORTED_EXPORT_FORMATS = {"markdown"}


@router.get(
    "/{meeting_id}/export",
    summary="Export a meeting as Markdown",
    description=(
        "Streams a Markdown file download with the meeting's title, date, "
        "participants, summary, key points, action items (as a checklist), "
        "chapters, and a bounded inline transcript excerpt. Only "
        "`format=markdown` is implemented today — it's Notion- and "
        "Obsidian-compatible by construction, since both import/read `.md` "
        "files natively. 400 `unsupported_export_format` for anything else; "
        "PDF export is planned but not yet implemented."
    ),
)
async def export_meeting(
    meeting_id: str,
    format: str = Query("markdown"),
    workspace: Workspace = Depends(get_current_workspace),
    service: MeetingService = Depends(_service),
    repo: ProductMeetingsRepo = Depends(_repo),
) -> Response:
    fmt = format.lower()
    if fmt not in _SUPPORTED_EXPORT_FORMATS:
        raise ApiError(
            400,
            "unsupported_export_format",
            f"Unsupported export format '{format}'. Supported: markdown. "
            "PDF export is planned but not yet implemented.",
        )

    record, scoped = await _load_scoped_meeting(meeting_id, workspace.id, service, repo)
    meeting = to_meeting(record, title=scoped.get("title"))
    meeting.workspace_id = workspace.id
    insights = insights_from_row(scoped.get("insights"))
    segments = segments_from_transcript(record.transcript)

    body = build_meeting_markdown(meeting, insights, segments)
    filename = markdown_filename(meeting)
    return Response(
        content=body,
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get(
    "/{meeting_id}/analytics",
    response_model=MeetingAnalytics,
    summary="Get meeting conversation analytics",
    description=(
        "Returns talk-time, interactivity, and sentiment analytics for a "
        "meeting, computed deterministically from the diarized transcript "
        "with no LLM call — works even if the AI service is unavailable. "
        "Returns zeroed metrics for a meeting with no transcript yet."
    ),
)
async def get_meeting_analytics(
    meeting_id: str,
    workspace: Workspace = Depends(get_current_workspace),
    service: MeetingService = Depends(_service),
    repo: ProductMeetingsRepo = Depends(_repo),
) -> MeetingAnalytics:
    return await _resolved_analytics(meeting_id, workspace, service, repo)


async def _resolved_analytics(meeting_id, workspace, service, repo):
    """Compute analytics with diarized labels resolved to named people."""
    record, _ = await _load_scoped_meeting(meeting_id, workspace.id, service, repo)
    segments = segments_from_transcript(record.transcript)
    from ...speakers import SpeakerProfilesRepo, build_alias_map

    profiles = await SpeakerProfilesRepo(repo._db).list(workspace.id)
    if profiles and segments:
        alias_map = build_alias_map(profiles)
        segments = [
            seg.model_copy(
                update={"speaker_name": alias_map.get((seg.speaker_name or "").lower(), seg.speaker_name)}
            )
            for seg in segments
        ]
    return compute_meeting_analytics(meeting_id, segments)


@router.get(
    "/{meeting_id}/coaching",
    response_model=CoachingScorecard,
    summary="Get a meeting coaching scorecard",
    description=(
        "Returns a coaching scorecard (talk ratio, monologue risk, "
        "discovery, balance) derived deterministically from the meeting's "
        "conversation analytics — no LLM call."
    ),
)
async def get_meeting_coaching(
    meeting_id: str,
    workspace: Workspace = Depends(get_current_workspace),
    service: MeetingService = Depends(_service),
    repo: ProductMeetingsRepo = Depends(_repo),
) -> CoachingScorecard:
    from ...coaching import compute_coaching

    analytics = await _resolved_analytics(meeting_id, workspace, service, repo)
    return CoachingScorecard.model_validate(compute_coaching(analytics))


@router.post(
    "/{meeting_id}/assist",
    response_model=MeetingAssist,
    summary="Get proactive during-call assist",
    description=(
        "Returns a recap-so-far, suggested questions, and coverage gaps "
        "computed from the transcript captured so far, via the ai-service "
        "`/assist` path. Meant to be polled repeatedly (~every 20s) while a "
        "meeting is live, so it uses a short timeout; a slow/unreachable "
        "ai-service degrades to an empty 'no suggestion this cycle' "
        "response rather than blocking the caller."
    ),
)
async def get_meeting_assist(
    meeting_id: str,
    workspace: Workspace = Depends(get_current_workspace),
    service: MeetingService = Depends(_service),
    repo: ProductMeetingsRepo = Depends(_repo),
) -> MeetingAssist:
    record, _ = await _load_scoped_meeting(meeting_id, workspace.id, service, repo)
    all_segments = segments_from_transcript(record.transcript)
    segments = [
        s.model_dump(by_alias=True)
        for s in all_segments[-_ASSIST_WINDOW_SEGMENTS:]
    ]
    try:
        data = await ai_client.assist({"meetingId": meeting_id, "segments": segments})
    except ApiError as exc:
        logger.warning("assist degraded (no suggestion this cycle) for %s: %s", meeting_id, exc)
        return MeetingAssist(segment_count=len(segments))
    return MeetingAssist(
        summary_so_far=str(data.get("summarySoFar", "")),
        suggested_questions=list(data.get("suggestedQuestions") or []),
        coverage_gaps=list(data.get("coverageGaps") or []),
        segment_count=int(data.get("segmentCount") or 0),
    )


@router.delete(
    "/{meeting_id}",
    response_model=Meeting,
    summary="Stop or cancel a meeting",
    description=(
        "Stops an in-progress meeting (or cancels a scheduled one). Also "
        "fires the completion pipeline on the transition to `completed`. "
        "Uses a guarded conditional update so a concurrent finalize request "
        "can't double-fire the pipeline."
    ),
)
async def stop_meeting(
    meeting_id: str,
    workspace: Workspace = Depends(get_current_workspace),
    service: MeetingService = Depends(_service),
    repo: ProductMeetingsRepo = Depends(_repo),
) -> Meeting:
    record, scoped = await _load_scoped_meeting(meeting_id, workspace.id, service, repo)
    if record.status.value not in ("completed", "failed"):
        if await service.complete_if_active(meeting_id):
            _fire_completion_pipeline(meeting_id)
    refreshed = await service.get_meeting_by_id(meeting_id) or record
    meeting = to_meeting(refreshed, title=scoped.get("title"))
    meeting.workspace_id = workspace.id
    return meeting


@router.post(
    "/{meeting_id}/summarize",
    response_model=MeetingInsights,
    summary="Summarize a meeting",
    description=(
        "Triggers the ai-service to generate a summary, key points, action "
        "items, and chapters from the transcript (persisted for later "
        "`GET /{id}`), then best-effort embeds the transcript for `/ask` "
        "and runs keyword trackers over it. Applies per-workspace PII "
        "redaction and an optional summary template (`templateId`, or the "
        "workspace default) before the transcript reaches the AI service."
    ),
)
async def summarize_meeting(
    meeting_id: str,
    template_id: Optional[str] = Query(None),
    workspace: Workspace = Depends(get_current_workspace),
    service: MeetingService = Depends(_service),
    repo: ProductMeetingsRepo = Depends(_repo),
    db: DatabaseConnection = Depends(get_db),
) -> MeetingInsights:
    await enforce_cost_cap(db, workspace.id)
    record, scoped = await _load_scoped_meeting(meeting_id, workspace.id, service, repo)
    segments = [
        s.model_dump(by_alias=True) for s in segments_from_transcript(record.transcript)
    ]
    # Apply per-workspace PII redaction + custom vocabulary before the
    # transcript reaches the AI service and embeddings (best-effort).
    custom_vocab: list[str] = []
    summary_language = "en"
    try:
        from ...redaction import NlpSettingsRepo, redact_segments

        nlp = await NlpSettingsRepo(db).get(workspace.id)
        custom_vocab = list(nlp.get("custom_vocab") or [])
        summary_language = nlp.get("summary_language") or "en"
        if nlp.get("redaction_enabled"):
            segments = redact_segments(segments, nlp)
    except Exception as exc:  # noqa: BLE001
        logger.warning("redaction skipped for %s: %s", meeting_id, exc)

    meta = {
        "title": scoped.get("title") or "",
        "participants": [
            p.model_dump(by_alias=True) for p in to_meeting(record).participants
        ],
    }
    if custom_vocab:
        meta["customVocabulary"] = custom_vocab
    if summary_language and summary_language != "en":
        meta["targetLanguage"] = summary_language
    # Apply the chosen template, or the workspace default. Best-effort: a missing
    # template never blocks summarization.
    template_meta = await _resolve_template_meta(db, workspace.id, template_id)
    if template_meta is not None:
        meta["template"] = template_meta

    payload = {"meetingId": meeting_id, "meta": meta, "segments": segments}
    data = await ai_client.summarize(payload)
    insights = MeetingInsights.model_validate(data)
    await capture_llm_usage(
        db,
        workspace_id=workspace.id,
        meeting_id=meeting_id,
        operation="summarize",
        data=data,
    )
    # Persist for later GET /{id}.
    await repo.store_insights(
        meeting_id, json.dumps(insights.model_dump(by_alias=True))
    )
    # Embed the transcript so chat-with-meeting (/ask) has vectors to retrieve.
    # Best-effort: a failed embed must not fail summary generation.
    if segments:
        try:
            embed_data = await ai_client.embed(
                {
                    "workspaceId": workspace.id,
                    "meetingId": meeting_id,
                    "segments": segments,
                }
            )
            await capture_llm_usage(
                db,
                workspace_id=workspace.id,
                meeting_id=meeting_id,
                operation="embed",
                data=embed_data,
            )
        except Exception as exc:  # noqa: BLE001 — embed is best-effort
            logger.warning("summarize embed failed for %s: %s", meeting_id, exc)
    # Run topic/keyword trackers over the transcript (best-effort).
    try:
        from ...trackers.service import run_trackers

        await run_trackers(
            repo._db,
            workspace_id=workspace.id,
            meeting_id=meeting_id,
            segments=segments,
            owner_id=None,  # summarize may run headless; hits recorded regardless
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("tracker scan failed for %s: %s", meeting_id, exc)
    return insights


@router.post(
    "/{meeting_id}/ask",
    response_model=AskResponse,
    summary="Ask a question about one meeting",
    description=(
        "Runs RAG retrieval scoped to a single meeting via the ai-service "
        "`/chat` endpoint, returning an answer with citations back into the "
        "transcript. Ensures the transcript is embedded first (idempotent "
        "upsert) even if `/summarize` was never called."
    ),
    responses={
        200: {
            "content": {
                "application/json": {
                    "example": {
                        "answer": "The team agreed to ship the v2 API by Friday.",
                        "citations": [
                            {
                                "segmentId": "seg_042",
                                "speakerName": "Jane Doe",
                                "text": "Let's target Friday for the v2 API release.",
                                "tStartSec": 812.4,
                                "meetingId": "3f9c2b1a-4d5e-4f6a-8b7c-9d0e1f2a3b4c",
                                "meetingTitle": "Weekly sync",
                            }
                        ],
                    }
                }
            }
        }
    },
)
async def ask_meeting(
    meeting_id: str,
    body: AskRequest,
    workspace: Workspace = Depends(get_current_workspace),
    service: MeetingService = Depends(_service),
    repo: ProductMeetingsRepo = Depends(_repo),
    db: DatabaseConnection = Depends(get_db),
) -> AskResponse:
    await enforce_cost_cap(db, workspace.id)
    record, _ = await _load_scoped_meeting(meeting_id, workspace.id, service, repo)
    # Ensure the transcript is embedded so RAG has vectors even if the user
    # never clicked "Generate summary". /embed upserts, so this is idempotent.
    segments = [
        s.model_dump(by_alias=True) for s in segments_from_transcript(record.transcript)
    ]
    if segments:
        try:
            embed_data = await ai_client.embed(
                {
                    "workspaceId": workspace.id,
                    "meetingId": meeting_id,
                    "segments": segments,
                }
            )
            await capture_llm_usage(
                db,
                workspace_id=workspace.id,
                meeting_id=meeting_id,
                operation="embed",
                data=embed_data,
            )
        except Exception as exc:  # noqa: BLE001 — embed is best-effort
            logger.warning("ask embed failed for %s: %s", meeting_id, exc)
    payload = {
        "workspaceId": workspace.id,
        "meetingId": meeting_id,
        "question": body.question,
        "history": body.history or [],
    }
    data = await ai_client.chat(payload)
    await capture_llm_usage(
        db,
        workspace_id=workspace.id,
        meeting_id=meeting_id,
        operation="chat",
        data=data,
    )
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
                        {
                            "type": "segment",
                            "segment": seg.model_dump(by_alias=True, mode="json"),
                        }
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
