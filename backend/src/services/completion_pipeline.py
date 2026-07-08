"""Post-meeting AI pipeline: embed → summarize → store insights → recap.

Fired as a background task when a meeting transitions to ``completed``. It:

1. Loads the meeting + its transcript segments.
2. Calls ai-service ``/embed`` (stores vectors in pgvector for RAG).
3. Calls ai-service ``/summarize`` and stores the returned ``MeetingInsights``
   on the meeting row's ``insights`` JSONB column.
4. Delivers a recap to the workspace's enabled outbound integrations.

Every external call is best-effort: if ai-service is down, we log and leave
``insights`` null (the user can still trigger ``POST /{id}/summarize`` later).
Integration delivery failures never fail the pipeline.
"""

from __future__ import annotations

import json
from typing import Optional

from ..api.database.connection import get_db_connection
from ..api.product import ai_client
from ..api.product.errors import ApiError
from ..api.product.mappers import segments_from_transcript, to_meeting
from ..api.product.meetings_repo import ProductMeetingsRepo
from ..api.product.schemas import MeetingInsights
from ..observability import get_logger
from ..usage import capture_llm_usage
from .meeting_service import MeetingService

logger = get_logger(__name__)


async def _workspace_id_for(db, meeting_id: str) -> Optional[str]:
    from ..api.product.meetings_repo import _meeting_table  # noqa: PLC0415

    table = _meeting_table(db)
    rows = await db.store.query_raw(
        f"SELECT workspace_id FROM {table} WHERE id = $1::uuid", meeting_id
    )
    if not rows:
        return None
    ws = rows[0].get("workspace_id")
    return str(ws) if ws else None


async def run_completion_pipeline(meeting_id: str) -> None:
    """Run embed + summarize + recap for a completed meeting. Never raises."""
    try:
        db = await get_db_connection()
        service = MeetingService(db)
        repo = ProductMeetingsRepo(db)

        record = await service.get_meeting_by_id(meeting_id)
        if record is None:
            logger.warning("completion_pipeline.meeting_missing", meeting_id=meeting_id)
            return

        workspace_id = await _workspace_id_for(db, meeting_id)
        scoped = (
            await repo.get_scoped(meeting_id, workspace_id) if workspace_id else None
        )
        title = (scoped or {}).get("title") or ""

        segments_models = segments_from_transcript(record.transcript)
        segments = [s.model_dump(by_alias=True, mode="json") for s in segments_models]

        if not segments:
            logger.info("completion_pipeline.no_segments", meeting_id=meeting_id)
            return

        # 1. Embed (for cross-meeting RAG). Tolerate failure.
        if workspace_id:
            try:
                embed_data = await ai_client.embed(
                    {
                        "workspaceId": workspace_id,
                        "meetingId": meeting_id,
                        "segments": segments,
                    }
                )
                await capture_llm_usage(
                    db,
                    workspace_id=workspace_id,
                    meeting_id=meeting_id,
                    operation="embed",
                    data=embed_data,
                )
                logger.info("completion_pipeline.embedded", meeting_id=meeting_id)
            except ApiError as exc:
                logger.warning(
                    "completion_pipeline.embed_unavailable",
                    meeting_id=meeting_id,
                    error=exc.message,
                )

        # 2. Summarize + store insights. Tolerate failure (leave insights null).
        insights: Optional[MeetingInsights] = None
        try:
            participants = [
                p.model_dump(by_alias=True, mode="json")
                for p in to_meeting(record).participants
            ]
            data = await ai_client.summarize(
                {
                    "meetingId": meeting_id,
                    "meta": {"title": title, "participants": participants},
                    "segments": segments,
                }
            )
            insights = MeetingInsights.model_validate(data)
            if workspace_id:
                await capture_llm_usage(
                    db,
                    workspace_id=workspace_id,
                    meeting_id=meeting_id,
                    operation="summarize",
                    data=data,
                )
            await repo.store_insights(
                meeting_id, json.dumps(insights.model_dump(by_alias=True))
            )
            logger.info("completion_pipeline.summarized", meeting_id=meeting_id)
        except ApiError as exc:
            logger.warning(
                "completion_pipeline.summarize_unavailable",
                meeting_id=meeting_id,
                error=exc.message,
            )

        # 3. Promote AI-extracted action items into trackable rows (idempotent).
        if insights is not None and workspace_id:
            await _sync_action_items(db, workspace_id, meeting_id, insights)

        # 4. Deliver recap to enabled outbound integrations.
        if insights is not None and workspace_id:
            await _deliver_recap(db, workspace_id, meeting_id, title, insights)

        # 5. Fan out developer webhooks (best-effort, never fails the pipeline).
        if workspace_id:
            await _emit_webhooks(db, workspace_id, meeting_id, title, insights)

    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "completion_pipeline.error", meeting_id=meeting_id, error=str(exc)
        )


async def _sync_action_items(db, workspace_id: str, meeting_id: str, insights) -> None:
    """Promote AI action items into trackable rows. Idempotent, best-effort."""
    try:
        from ..action_items import ActionItemsRepo, dedupe_ai_items

        items = dedupe_ai_items(insights.action_items)
        if not items:
            return
        inserted = await ActionItemsRepo(db).sync_ai_items(
            workspace_id=workspace_id, meeting_id=meeting_id, items=items
        )
        logger.info(
            "completion_pipeline.action_items_synced",
            meeting_id=meeting_id,
            inserted=inserted,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "completion_pipeline.action_items_sync_failed",
            meeting_id=meeting_id,
            error=str(exc),
        )


async def _emit_webhooks(
    db, workspace_id: str, meeting_id: str, title: str, insights
) -> None:
    """Emit transcript.ready, summary.ready and meeting.completed events."""
    try:
        from ..webhooks import emit_event

        base = {"meetingId": meeting_id, "title": title or ""}
        await emit_event(db, workspace_id, "transcript.ready", dict(base))
        if insights is not None:
            await emit_event(
                db,
                workspace_id,
                "summary.ready",
                {**base, "summary": insights.summary},
            )
        await emit_event(db, workspace_id, "meeting.completed", dict(base))
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "completion_pipeline.webhook_emit_failed",
            meeting_id=meeting_id,
            error=str(exc),
        )


async def _deliver_recap(
    db, workspace_id: str, meeting_id: str, title: str, insights: MeetingInsights
) -> None:
    try:
        from ..integrations import deliver_recap
        from ..integrations.models import MeetingRecap

        recap = MeetingRecap(
            meeting_id=meeting_id,
            title=title or "Meeting recap",
            summary=insights.summary,
            key_points=list(insights.key_points),
            action_items=[a.text for a in insights.action_items],
        )
        results = await deliver_recap(db, workspace_id, recap)
        logger.info(
            "completion_pipeline.recap_delivered",
            meeting_id=meeting_id,
            results=[r.model_dump() for r in results],
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "completion_pipeline.recap_failed",
            meeting_id=meeting_id,
            error=str(exc),
        )
