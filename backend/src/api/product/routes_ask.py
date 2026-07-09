"""Workspace-wide "Ask Parlor" API.

  POST /api/v1/ask  { question, history? }  -> { answer, citations[] }

Unlike POST /meetings/{id}/ask (single meeting), this runs RAG retrieval across
the ENTIRE workspace transcript corpus — the marquee "ask across all meetings"
capability. The ai-service /chat endpoint already does workspace-wide retrieval
when meetingId is null; here we resolve each citation back to its source
meeting title so the UI can link to it.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends

from ...quota import enforce_cost_cap
from ...usage import capture_llm_usage
from ..database.connection import DatabaseConnection
from . import ai_client
from .deps import get_current_workspace, get_db
from .meetings_repo import ProductMeetingsRepo
from .schemas import AskRequest, AskResponse, Citation, Workspace

logger = logging.getLogger("product.ask")

router = APIRouter(prefix="/api/v1", tags=["ask"])


async def _repo(db: DatabaseConnection = Depends(get_db)) -> ProductMeetingsRepo:
    return ProductMeetingsRepo(db)


@router.post(
    "/ask",
    response_model=AskResponse,
    summary="Ask a question across the whole workspace",
    description=(
        "Runs RAG retrieval over the entire workspace transcript corpus (not "
        "just one meeting) via the ai-service /chat endpoint and resolves "
        "each citation back to its source meeting title."
    ),
)
async def ask_workspace(
    body: AskRequest,
    workspace: Workspace = Depends(get_current_workspace),
    repo: ProductMeetingsRepo = Depends(_repo),
    db: DatabaseConnection = Depends(get_db),
) -> AskResponse:
    await enforce_cost_cap(db, workspace.id)
    payload = {
        "workspaceId": workspace.id,
        "meetingId": None,  # null => workspace-wide retrieval
        "question": body.question,
        "history": body.history or [],
    }
    data = await ai_client.chat(payload)
    await capture_llm_usage(
        db,
        workspace_id=workspace.id,
        meeting_id=None,
        operation="chat",
        data=data,
    )

    raw_citations = [c for c in (data.get("citations") or []) if isinstance(c, dict)]

    # Resolve meeting titles for the cited meetings (small N — top_k citations).
    title_cache: dict[str, str | None] = {}
    citations: list[Citation] = []
    for c in raw_citations:
        meeting_id = c.get("meetingId") or c.get("meeting_id")
        title: str | None = None
        if meeting_id:
            if meeting_id not in title_cache:
                record = await repo.get_scoped(str(meeting_id), workspace.id)
                title_cache[meeting_id] = (
                    str(record["title"]) if record and record.get("title") else None
                )
            title = title_cache[meeting_id]
        citations.append(
            Citation(
                segment_id=str(c.get("segmentId") or c.get("segment_id") or ""),
                speaker_name=str(c.get("speakerName") or c.get("speaker_name") or "Unknown"),
                text=str(c.get("text") or ""),
                t_start_sec=float(c.get("tStartSec") or c.get("t_start_sec") or 0),
                meeting_id=str(meeting_id) if meeting_id else None,
                meeting_title=title,
            )
        )

    return AskResponse(answer=str(data.get("answer", "")), citations=citations)
