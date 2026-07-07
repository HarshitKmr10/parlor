"""Mock-mode groundedness check for /chat's RAG citations.

Mirrors tests/test_chat.py's DB conventions: a real Postgres/pgvector
instance is required (``DATABASE_URL``, defaulting to the same
``postgresql://meeting:meeting@localhost:5432/meeting`` test_chat.py uses),
and the fixture ``pytest.skip``s cleanly if it isn't reachable rather than
failing -- this is a real-store integration check, not a unit test.

The invariant this closes: after embedding a transcript's segments via the
same mock ``ProviderRouter``/``EmbeddingStore.upsert_segments`` path
``/embed`` uses, and then asking a grounded question via
``answer_question`` (the same function ``/chat`` calls, with
``is_mock=True``), every citation returned must reference a
(meetingId, segmentId) pair that was actually embedded from the fixture --
never a fabricated id -- and the citation text must be the fixture's own
segment text, not paraphrased or invented.
"""

from __future__ import annotations

import os
import uuid

import pytest

from app.config import Settings
from app.providers.mock_provider import hash_embedding
from app.providers.router import ProviderRouter
from app.rag.chat import answer_question
from app.rag.store import EmbeddingStore

from ._helpers import fixture_segments

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql://meeting:meeting@localhost:5432/meeting"
)


def _mock_settings() -> Settings:
    return Settings(
        anthropic_api_key=None,
        openai_api_key=None,
        azure_openai_endpoint=None,
        azure_openai_api_key=None,
        azure_openai_api_version="2024-02-15-preview",
        azure_openai_deployment="gpt-5.4-mini",
        azure_openai_embedding_deployment=None,
        provider_order=[],
        database_url=DATABASE_URL,
        mode="mock",
    )


@pytest.fixture
async def store():
    s = EmbeddingStore(DATABASE_URL)
    await s.init()
    if not s.ready:
        pytest.skip(f"Postgres/pgvector not reachable at {DATABASE_URL}")
    yield s
    await s.close()


@pytest.fixture
def router() -> ProviderRouter:
    return ProviderRouter(_mock_settings())


@pytest.fixture
def workspace_id() -> str:
    return f"ws-eval-{uuid.uuid4().hex[:12]}"


async def _cleanup(store: EmbeddingStore, workspace_id: str) -> None:
    async with store._pool.acquire() as conn:  # noqa: SLF001
        await conn.execute(
            "DELETE FROM meeting_embeddings WHERE workspace_id = $1", workspace_id
        )


async def test_chat_citations_are_grounded_in_the_embedded_fixture_transcript(
    store, router, workspace_id
):
    segments = fixture_segments("chat_topic_meeting")
    meeting_id = "eval-chat-1"
    embeddings = [hash_embedding(s.text) for s in segments]
    await store.upsert_segments(
        workspace_id=workspace_id,
        meeting_id=meeting_id,
        segments=segments,
        embeddings=embeddings,
    )

    valid_segment_ids = {s.id for s in segments}
    segment_text_by_id = {s.id: s.text for s in segments}

    response = await answer_question(
        router,
        store,
        workspace_id=workspace_id,
        meeting_id=meeting_id,
        question="When is the budget approval deadline?",
        history=[],
        is_mock=True,
    )

    assert response.citations, "expected at least one grounded citation"
    for citation in response.citations:
        assert citation.segment_id in valid_segment_ids, (
            f"citation referenced segment_id {citation.segment_id!r} that was "
            "never embedded from the fixture transcript"
        )
        assert citation.text == segment_text_by_id[citation.segment_id]

    # The specific fact ("next Friday" deadline, segment c1) should surface
    # for a question that directly asks about it.
    cited_ids = {c.segment_id for c in response.citations}
    assert "c1" in cited_ids

    await _cleanup(store, workspace_id)


async def test_chat_returns_no_fabricated_citations_for_an_unrelated_question(
    store, router, workspace_id
):
    """A question with no keyword overlap with the fixture should not
    fabricate citations pointing at unrelated segments."""
    segments = fixture_segments("chat_topic_meeting")
    meeting_id = "eval-chat-1"
    embeddings = [hash_embedding(s.text) for s in segments]
    await store.upsert_segments(
        workspace_id=workspace_id,
        meeting_id=meeting_id,
        segments=segments,
        embeddings=embeddings,
    )

    response = await answer_question(
        router,
        store,
        workspace_id=workspace_id,
        meeting_id=meeting_id,
        question="What is the capital of France?",
        history=[],
        is_mock=True,
    )

    valid_segment_ids = {s.id for s in segments}
    for citation in response.citations:
        assert citation.segment_id in valid_segment_ids

    await _cleanup(store, workspace_id)
