"""RAG chat: retrieve relevant segments, build a grounded prompt, answer.

Live mode embeds the question and runs cosine vector search. Mock mode uses
keyword search (the mock embedder is hash-based, so cosine search still works,
but keyword search yields more legible mock citations). Either way the answer
is grounded in retrieved segments and returned with citations.
"""

from __future__ import annotations

import logging

from ..config import DEFAULT_TOP_K
from ..providers import ProviderRouter
from ..schemas import ChatMessage, ChatResponse, Citation
from .store import EmbeddingStore, RetrievedSegment

logger = logging.getLogger("ai-service.chat")

_SYSTEM = (
    "You answer questions about a meeting using ONLY the provided transcript "
    "excerpts. If the excerpts do not contain the answer, say so. Cite "
    "speakers and be concise."
)


def _format_excerpts(segments: list[RetrievedSegment]) -> str:
    lines = []
    for s in segments:
        ts = f"{int(s.t_start_sec // 60):02d}:{int(s.t_start_sec % 60):02d}"
        lines.append(f"[{ts}] {s.speaker_name}: {s.text}")
    return "\n".join(lines)


def _format_history(history: list[ChatMessage]) -> str:
    if not history:
        return ""
    turns = [f"{m.role}: {m.content}" for m in history[-6:]]
    return "Prior conversation:\n" + "\n".join(turns) + "\n\n"


async def answer_question(
    router: ProviderRouter,
    store: EmbeddingStore,
    *,
    workspace_id: str,
    meeting_id: str | None,
    question: str,
    history: list[ChatMessage],
    is_mock: bool,
    top_k: int = DEFAULT_TOP_K,
) -> ChatResponse:
    """Run retrieval + grounded generation and return answer + citations."""
    if not store.ready:
        raise RuntimeError("embedding store not available for chat retrieval")

    retrieved: list[RetrievedSegment] = []

    if is_mock:
        # Keyword search gives legible mock citations; fall back to vector
        # search over hash embeddings if no keyword hits.
        retrieved = await store.keyword_search(
            workspace_id=workspace_id,
            meeting_id=meeting_id,
            question=question,
            top_k=top_k,
        )
        if not retrieved:
            embedding = (await router.embed([question]))[0]
            retrieved = await store.search(
                workspace_id=workspace_id,
                meeting_id=meeting_id,
                embedding=embedding,
                top_k=top_k,
            )
    else:
        embedding = (await router.embed([question]))[0]
        retrieved = await store.search(
            workspace_id=workspace_id,
            meeting_id=meeting_id,
            embedding=embedding,
            top_k=top_k,
        )

    citations = [
        Citation(
            segment_id=s.segment_id,
            speaker_name=s.speaker_name,
            text=s.text,
            t_start_sec=s.t_start_sec,
        )
        for s in retrieved
    ]

    if not retrieved:
        return ChatResponse(
            answer=(
                "I couldn't find anything relevant in the meeting transcript "
                "to answer that."
            ),
            citations=[],
        )

    excerpts = _format_excerpts(retrieved)
    user = (
        f"{_format_history(history)}"
        f"Transcript excerpts:\n{excerpts}\n\n"
        f"Question: {question}"
    )

    answer = await router.complete_text(
        system=_SYSTEM,
        user=user,
        premium=True,
        mock_context={
            "question": question,
            "snippets": [s.text for s in retrieved],
        },
    )

    return ChatResponse(answer=answer, citations=citations)
