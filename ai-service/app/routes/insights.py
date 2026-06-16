"""Routes for /summarize, /embed, /chat."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException

from ..config import settings
from ..dependencies import get_router, get_store
from ..providers import ProviderError, ProviderRouter
from ..rag import EmbeddingStore, answer_question, summarize_meeting
from ..schemas import (
    ChatRequest,
    ChatResponse,
    EmbedRequest,
    EmbedResponse,
    MeetingInsights,
    SummarizeRequest,
)

logger = logging.getLogger("ai-service.routes")
router = APIRouter()


def _error(status: int, code: str, message: str) -> HTTPException:
    """Build an HTTPException whose detail is the structured error body.

    The exception handler in main.py wraps detail into the
    ``{"error": {code, message}}`` envelope.
    """
    return HTTPException(status_code=status, detail={"code": code, "message": message})


@router.post("/summarize", response_model=MeetingInsights, response_model_by_alias=True)
async def summarize(
    payload: SummarizeRequest,
    provider_router: ProviderRouter = Depends(get_router),
) -> MeetingInsights:
    if not payload.segments:
        raise _error(422, "empty_transcript", "No transcript segments provided.")
    try:
        return await summarize_meeting(
            provider_router,
            meeting_id=payload.meeting_id,
            meta=payload.meta,
            segments=payload.segments,
        )
    except ProviderError as exc:
        logger.error("summarize failed: %s", exc)
        raise _error(502, "provider_error", exc.message) from exc


@router.post("/embed", response_model=EmbedResponse, response_model_by_alias=True)
async def embed(
    payload: EmbedRequest,
    provider_router: ProviderRouter = Depends(get_router),
    store: EmbeddingStore = Depends(get_store),
) -> EmbedResponse:
    if not store.ready:
        raise _error(
            503,
            "store_unavailable",
            "Embedding store is not available (DATABASE_URL unset or "
            "Postgres/pgvector unreachable).",
        )
    if not payload.segments:
        return EmbedResponse(embedded=0)

    try:
        embeddings = await provider_router.embed([s.text for s in payload.segments])
    except ProviderError as exc:
        logger.error("embed failed: %s", exc)
        raise _error(502, "provider_error", exc.message) from exc

    try:
        count = await store.upsert_segments(
            workspace_id=payload.workspace_id,
            meeting_id=payload.meeting_id,
            segments=payload.segments,
            embeddings=embeddings,
        )
    except Exception as exc:
        logger.error("embed store write failed: %s", exc)
        raise _error(502, "store_error", str(exc)) from exc

    return EmbedResponse(embedded=count)


@router.post("/chat", response_model=ChatResponse, response_model_by_alias=True)
async def chat(
    payload: ChatRequest,
    provider_router: ProviderRouter = Depends(get_router),
    store: EmbeddingStore = Depends(get_store),
) -> ChatResponse:
    if not payload.question.strip():
        raise _error(422, "empty_question", "Question must not be empty.")
    if not store.ready:
        raise _error(
            503,
            "store_unavailable",
            "Embedding store is not available; cannot run RAG retrieval.",
        )
    try:
        return await answer_question(
            provider_router,
            store,
            workspace_id=payload.workspace_id,
            meeting_id=payload.meeting_id,
            question=payload.question,
            history=payload.history,
            is_mock=settings.is_mock,
        )
    except ProviderError as exc:
        logger.error("chat failed: %s", exc)
        raise _error(502, "provider_error", exc.message) from exc
    except RuntimeError as exc:
        raise _error(503, "store_unavailable", str(exc)) from exc
