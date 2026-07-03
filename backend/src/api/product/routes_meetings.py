"""/api/v1/meetings/* product router (workspace-scoped)."""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request, WebSocket, WebSocketDisconnect

from shared.exceptions import InvalidMeetingURLError

from ...analytics import compute_meeting_analytics
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
            raise ApiError(400, "invalid_status", f"Unknown status values: {unknown}")
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

    # Enforce the plan's monthly meeting quota (best-effort; never blocks on a
    # billing-lookup error).
    try:
        from ...billing import BillingRepo, within_meeting_quota

        billing = BillingRepo(repo._db)
        plan = (await billing.get(workspace.id))["plan"]
        used = await billing.meetings_this_month(workspace.id)
        if not within_meeting_quota(plan, used):
            raise ApiError(
                402,
                "quota_exceeded",
                f"Your {plan} plan's monthly meeting limit is reached. Upgrade to add more.",
            )
    except ApiError:
        raise
    except Exception:  # noqa: BLE001 — billing lookup must not block creation
        pass

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


@router.post("/botless", response_model=Meeting, status_code=201)
async def create_botless_meeting(
    body: BotlessCreateRequest,
    workspace: Workspace = Depends(get_current_workspace),
    service: MeetingService = Depends(_service),
    repo: ProductMeetingsRepo = Depends(_repo),
) -> Meeting:
    """Create a workspace-scoped meeting WITHOUT dispatching a bot.

    Used by the desktop-capture client: audio is captured + transcribed
    client-side and segments are pushed via ``POST /{id}/transcript``. The
    meeting carries a synthetic ``desktop://<workspaceId>/<timestamp>`` URL,
    platform ``desktop``, starts ``ongoing``, and has no bot name.
    """
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


@router.post("/{meeting_id}/transcript", response_model=TranscriptIngestResponse)
async def ingest_transcript(
    meeting_id: str,
    body: TranscriptIngestRequest,
    workspace: Workspace = Depends(get_current_workspace),
    service: MeetingService = Depends(_service),
    repo: ProductMeetingsRepo = Depends(_repo),
) -> TranscriptIngestResponse:
    """Append externally-captured transcript segments to a meeting.

    Reuses the internal ``append_transcript_segment`` so the row's transcript
    JSON, ``totalSegments`` and ``lastSegmentTime`` stay consistent with the
    bot-driven path. Each segment is appended in ``tStartSec`` order; the
    ``createdAt`` (or "now") timestamp drives the ``since`` cursor + live WS.
    Out-of-order or missing timestamps are clamped to a monotonic value so the
    cursor never regresses.
    """
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


@router.post("/{meeting_id}/capture/{provider}", response_model=TranscriptIngestResponse)
async def capture_native(
    meeting_id: str,
    provider: str,
    request: Request,
    workspace: Workspace = Depends(get_current_workspace),
    service: MeetingService = Depends(_service),
    repo: ProductMeetingsRepo = Depends(_repo),
) -> TranscriptIngestResponse:
    """Botless native capture: ingest a platform-native transcript (Zoom/Teams
    cloud recording, or WebVTT) without a bot joining. The payload is normalized
    to internal segments and appended via the same path as bot/botless capture.
    """
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


@router.post("/{meeting_id}/complete", response_model=Meeting)
async def complete_meeting(
    meeting_id: str,
    workspace: Workspace = Depends(get_current_workspace),
    service: MeetingService = Depends(_service),
    repo: ProductMeetingsRepo = Depends(_repo),
) -> Meeting:
    """Finalize a meeting (``ongoing`` → ``completed``) and run the AI pipeline.

    Used by botless desktop-capture to finalize a session. Idempotent: if the
    meeting is already terminal, this is a no-op that returns the current state.
    Transitioning to ``completed`` fires the embed→summarize→recap pipeline.

    Uses the guarded ``complete_if_active`` (a conditional UPDATE) rather than
    an unconditional ``update_meeting_status`` so two concurrent finalize
    requests can't both observe a non-terminal status and both fire the
    pipeline — only the request whose write actually lands (first past the
    row lock) triggers it. See #60.
    """
    record, scoped = await _load_scoped_meeting(meeting_id, workspace.id, service, repo)
    if record.status.value not in ("completed", "failed"):
        if await service.complete_if_active(meeting_id):
            _fire_completion_pipeline(meeting_id)
    refreshed = await service.get_meeting_by_id(meeting_id) or record
    meeting = to_meeting(refreshed, title=scoped.get("title"))
    meeting.workspace_id = workspace.id
    return meeting


@router.get("/{meeting_id}", response_model=MeetingWithInsights)
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


@router.get("/{meeting_id}/analytics", response_model=MeetingAnalytics)
async def get_meeting_analytics(
    meeting_id: str,
    workspace: Workspace = Depends(get_current_workspace),
    service: MeetingService = Depends(_service),
    repo: ProductMeetingsRepo = Depends(_repo),
) -> MeetingAnalytics:
    """Conversation analytics (talk-time, interactivity, sentiment) for a meeting.

    Computed deterministically from the diarized transcript — no LLM call — so it
    works even when the AI service is unavailable. Returns zeroed metrics for a
    meeting with no transcript yet.
    """
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


@router.get("/{meeting_id}/coaching", response_model=CoachingScorecard)
async def get_meeting_coaching(
    meeting_id: str,
    workspace: Workspace = Depends(get_current_workspace),
    service: MeetingService = Depends(_service),
    repo: ProductMeetingsRepo = Depends(_repo),
) -> CoachingScorecard:
    """A coaching scorecard (talk ratio, monologue risk, discovery, balance)
    derived from the meeting's conversation analytics. Deterministic."""
    from ...coaching import compute_coaching

    analytics = await _resolved_analytics(meeting_id, workspace, service, repo)
    return CoachingScorecard.model_validate(compute_coaching(analytics))


@router.post("/{meeting_id}/assist", response_model=MeetingAssist)
async def get_meeting_assist(
    meeting_id: str,
    workspace: Workspace = Depends(get_current_workspace),
    service: MeetingService = Depends(_service),
    repo: ProductMeetingsRepo = Depends(_repo),
) -> MeetingAssist:
    """Proactive during-call assist: recap-so-far, suggested questions, and
    coverage gaps computed from the transcript captured so far. Deterministic
    via the ai-service /assist path.

    Called repeatedly while a meeting is live, so it uses a short ai-service
    timeout (``ai_client._ASSIST_TIMEOUT``) rather than the generic batch
    timeout. A slow/unreachable ai-service degrades to an empty "no
    suggestion this cycle" response instead of blocking the caller for up to
    the batch timeout — the next poll will simply try again.
    """
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


@router.delete("/{meeting_id}", response_model=Meeting)
async def stop_meeting(
    meeting_id: str,
    workspace: Workspace = Depends(get_current_workspace),
    service: MeetingService = Depends(_service),
    repo: ProductMeetingsRepo = Depends(_repo),
) -> Meeting:
    """Stop a meeting. Uses the guarded ``complete_if_active`` (a conditional
    UPDATE) rather than an unconditional write so a concurrent finalize
    request can't double-fire the completion pipeline. See #60."""
    record, scoped = await _load_scoped_meeting(meeting_id, workspace.id, service, repo)
    if record.status.value not in ("completed", "failed"):
        if await service.complete_if_active(meeting_id):
            _fire_completion_pipeline(meeting_id)
    refreshed = await service.get_meeting_by_id(meeting_id) or record
    meeting = to_meeting(refreshed, title=scoped.get("title"))
    meeting.workspace_id = workspace.id
    return meeting


@router.post("/{meeting_id}/summarize", response_model=MeetingInsights)
async def summarize_meeting(
    meeting_id: str,
    template_id: Optional[str] = Query(None),
    workspace: Workspace = Depends(get_current_workspace),
    service: MeetingService = Depends(_service),
    repo: ProductMeetingsRepo = Depends(_repo),
    db: DatabaseConnection = Depends(get_db),
) -> MeetingInsights:
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
    # Persist for later GET /{id}.
    await repo.store_insights(
        meeting_id, json.dumps(insights.model_dump(by_alias=True))
    )
    # Embed the transcript so chat-with-meeting (/ask) has vectors to retrieve.
    # Best-effort: a failed embed must not fail summary generation.
    if segments:
        try:
            await ai_client.embed(
                {
                    "workspaceId": workspace.id,
                    "meetingId": meeting_id,
                    "segments": segments,
                }
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


@router.post("/{meeting_id}/ask", response_model=AskResponse)
async def ask_meeting(
    meeting_id: str,
    body: AskRequest,
    workspace: Workspace = Depends(get_current_workspace),
    service: MeetingService = Depends(_service),
    repo: ProductMeetingsRepo = Depends(_repo),
) -> AskResponse:
    record, _ = await _load_scoped_meeting(meeting_id, workspace.id, service, repo)
    # Ensure the transcript is embedded so RAG has vectors even if the user
    # never clicked "Generate summary". /embed upserts, so this is idempotent.
    segments = [
        s.model_dump(by_alias=True) for s in segments_from_transcript(record.transcript)
    ]
    if segments:
        try:
            await ai_client.embed(
                {
                    "workspaceId": workspace.id,
                    "meetingId": meeting_id,
                    "segments": segments,
                }
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
