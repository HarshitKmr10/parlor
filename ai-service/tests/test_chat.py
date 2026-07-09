"""Integration tests for answer_question's mock-vs-live retrieval agreement.

Runs the mock provider router (no LLM keys needed) against the shared local
Postgres/pgvector instance, mirroring tests/test_store.py's DB conventions.

Mock mode (chat.py's is_mock branch) retrieves via ``store.keyword_search``
(ILIKE scoring), falling back to vector search if there are no keyword hits.
Live mode (chat.py's else branch) retrieves via embed-then-
``store.hybrid_search`` -- vector cosine search fused with keyword ranking
via Reciprocal Rank Fusion -- not vector search alone. These are genuinely
different algorithms, not the same code behind a different embedder -- these
tests run both against one shared fixture corpus and assert they agree on
which segments are relevant, so a future change that makes one path stop
finding what the other finds is caught here rather than discovered as a
silent quality regression in prod.
"""

from __future__ import annotations

import os
import uuid

import pytest

from app.config import EMBEDDING_DIM, Settings
from app.providers import ProviderRouter
from app.providers.mock_provider import hash_embedding
from app.rag.chat import answer_question
from app.rag.store import EmbeddingStore
from app.schemas import TranscriptSegment

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql://meeting:meeting@localhost:5432/meeting"
)


def _segment(seg_id: str, text: str) -> TranscriptSegment:
    return TranscriptSegment(
        id=seg_id,
        speaker_name="Alice",
        text=text,
        t_start_sec=0.0,
    )


def _mock_settings() -> Settings:
    return Settings(
        anthropic_api_key=None,
        openai_api_key=None,
        gemini_api_key=None,
        azure_openai_endpoint=None,
        azure_openai_api_key=None,
        azure_openai_api_version="2024-02-15-preview",
        azure_openai_deployment="gpt-5.4-mini",
        azure_openai_embedding_deployment=None,
        provider_order=["azure", "anthropic", "openai"],
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
    return f"ws-test-{uuid.uuid4().hex[:12]}"


async def _cleanup(store: EmbeddingStore, workspace_id: str) -> None:
    async with store._pool.acquire() as conn:  # noqa: SLF001
        await conn.execute(
            "DELETE FROM meeting_embeddings WHERE workspace_id = $1", workspace_id
        )


_FIXTURE_CORPUS = [
    ("roadmap-1", "the product roadmap review happens every Friday afternoon"),
    ("roadmap-2", "we need to finalize the roadmap before the Friday review"),
    ("budget-1", "the quarterly budget needs approval from finance by next week"),
    ("budget-2", "finance is reviewing the budget numbers for next quarter"),
    ("onboarding-1", "new hire onboarding documentation was updated yesterday"),
]


async def _seed_fixture_corpus(store: EmbeddingStore, workspace_id: str) -> None:
    segments = [_segment(seg_id, text) for seg_id, text in _FIXTURE_CORPUS]
    embeddings = [hash_embedding(text, dim=EMBEDDING_DIM) for _, text in _FIXTURE_CORPUS]
    await store.upsert_segments(
        workspace_id=workspace_id,
        meeting_id="m1",
        segments=segments,
        embeddings=embeddings,
    )


async def test_mock_keyword_search_and_live_hybrid_search_agree_on_relevant_segments(
    store, workspace_id
):
    """Both retrieval algorithms, run against the same corpus with the same
    question, must return overlapping relevant result sets."""
    await _seed_fixture_corpus(store, workspace_id)
    question = "when is the roadmap review scheduled"

    # Mock path: ILIKE keyword search.
    keyword_results = await store.keyword_search(
        workspace_id=workspace_id,
        meeting_id=None,
        question=question,
        top_k=3,
    )

    # Live path: embed the question, then hybrid (vector + keyword, RRF-fused) search.
    question_embedding = hash_embedding(question, dim=EMBEDDING_DIM)
    hybrid_results = await store.hybrid_search(
        workspace_id=workspace_id,
        meeting_id=None,
        embedding=question_embedding,
        question=question,
        top_k=3,
    )

    keyword_ids = {r.segment_id for r in keyword_results}
    hybrid_ids = {r.segment_id for r in hybrid_results}

    assert keyword_ids, "keyword search found nothing for a question with obvious keyword overlap"
    assert hybrid_ids, "hybrid search found nothing for a question with related fixture content"

    # Both algorithms should surface the roadmap segments -- the two paths
    # would structurally diverge (e.g. one path silently returning unrelated
    # or empty results) without ever failing an assertion if only checked
    # independently, which is exactly the gap this test closes.
    assert keyword_ids & {"roadmap-1", "roadmap-2"}, keyword_ids
    assert hybrid_ids & {"roadmap-1", "roadmap-2"}, hybrid_ids
    assert keyword_ids & hybrid_ids, (keyword_ids, hybrid_ids)

    await _cleanup(store, workspace_id)


async def test_mock_and_live_paths_via_answer_question_agree_on_relevant_segments(
    store, router, workspace_id
):
    """End-to-end equivalent of the above, going through ``answer_question``
    exactly as the mock (``is_mock=True``) and live (``is_mock=False``)
    branches in chat.py do, rather than calling the store methods directly."""
    await _seed_fixture_corpus(store, workspace_id)
    question = "when is the roadmap review scheduled"

    mock_response = await answer_question(
        router,
        store,
        workspace_id=workspace_id,
        meeting_id=None,
        question=question,
        history=[],
        is_mock=True,
    )
    live_response = await answer_question(
        router,
        store,
        workspace_id=workspace_id,
        meeting_id=None,
        question=question,
        history=[],
        is_mock=False,
    )

    mock_ids = {c.segment_id for c in mock_response.citations}
    live_ids = {c.segment_id for c in live_response.citations}

    assert mock_ids, "mock (keyword) path returned no citations"
    assert live_ids, "live (vector) path returned no citations"
    assert mock_ids & live_ids, (mock_ids, live_ids)

    await _cleanup(store, workspace_id)
