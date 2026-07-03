"""Tests for EmbeddingStore.

Two kinds of coverage live here:

* Unit tests for ``init()``'s pool lifecycle on partial-init failure (no DB
  needed -- ``asyncpg.create_pool`` is mocked).
* Integration tests for ``hybrid_search`` (RRF fusion of vector + keyword
  retrieval), which run against the shared local Postgres/pgvector instance
  (same one the service itself uses -- set via DATABASE_URL, default matches
  this repo's docker-compose convention: postgresql://meeting:meeting@
  localhost:5432/meeting). Each integration test uses a fresh, random
  workspace_id so rows never collide across tests or runs, and cleans up its
  own rows afterward. They skip (not fail) when Postgres/pgvector isn't
  reachable.
"""

from __future__ import annotations

import os
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.config import EMBEDDING_DIM
from app.rag.store import EmbeddingStore
from app.schemas import TranscriptSegment

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql://meeting:meeting@localhost:5432/meeting"
)


# --- init (pool lifecycle on partial-init failure) ---------------------------


async def test_init_closes_pool_when_ddl_fails_after_pool_creation():
    """Regression: if create_pool succeeds but a DDL statement then raises,
    the already-open pool must be closed, not just dropped on the floor."""
    mock_conn = AsyncMock()
    mock_conn.execute.side_effect = RuntimeError("boom")

    mock_acquire_ctx = AsyncMock()
    mock_acquire_ctx.__aenter__.return_value = mock_conn

    mock_pool = MagicMock()
    mock_pool.acquire = MagicMock(return_value=mock_acquire_ctx)
    mock_pool.close = AsyncMock()

    with patch("app.rag.store.asyncpg.create_pool", AsyncMock(return_value=mock_pool)):
        s = EmbeddingStore("postgresql://irrelevant/for-this-test")
        await s.init()

    assert s.ready is False
    mock_pool.close.assert_awaited_once()


async def test_init_does_not_call_close_when_create_pool_itself_fails():
    """When create_pool raises before a pool ever exists, there is nothing to
    close -- init should not error trying to close a pool that was never made."""
    with patch(
        "app.rag.store.asyncpg.create_pool",
        AsyncMock(side_effect=RuntimeError("connection refused")),
    ):
        s = EmbeddingStore("postgresql://irrelevant/for-this-test")
        await s.init()  # must not raise

    assert s.ready is False


# --- hybrid_search (RRF fusion of vector + keyword) --------------------------


def _vec(seed: float) -> list[float]:
    """A fixed-width vector matching the real ``vector(EMBEDDING_DIM)`` column."""
    return [seed] + [0.0] * (EMBEDDING_DIM - 1)


def _vec_dim(index: int) -> list[float]:
    """A unit vector along a single dimension.

    Unlike ``_vec``, which always points along dimension 0 (so every
    ``_vec(seed)`` for seed > 0 has cosine distance 0 from every other one),
    this lets tests construct embeddings that are genuinely far apart
    (different index -> orthogonal -> cosine distance 1) or genuinely
    identical (same index -> cosine distance 0), which is what the
    hybrid-search "vector-only findable" / "keyword-only findable" tests
    need: a controlled, deliberate mismatch between a row's text and its
    embedding.
    """
    v = [0.0] * EMBEDDING_DIM
    v[index] = 1.0
    return v


def _segment(seg_id: str, text: str) -> TranscriptSegment:
    return TranscriptSegment(
        id=seg_id,
        speaker_name="Alice",
        text=text,
        t_start_sec=0.0,
    )


@pytest.fixture
async def store():
    """A ready EmbeddingStore against the shared test Postgres, with a
    dimension-agnostic vector column (we don't rely on the ivfflat index or
    EMBEDDING_DIM=1536 for these tests, just correctness of the SQL)."""
    s = EmbeddingStore(DATABASE_URL)
    await s.init()
    if not s.ready:
        pytest.skip(f"Postgres/pgvector not reachable at {DATABASE_URL}")
    yield s
    await s.close()


@pytest.fixture
def workspace_id() -> str:
    return f"ws-test-{uuid.uuid4().hex[:12]}"


async def _cleanup(store: EmbeddingStore, workspace_id: str) -> None:
    async with store._pool.acquire() as conn:  # noqa: SLF001 (test-only introspection)
        await conn.execute(
            "DELETE FROM meeting_embeddings WHERE workspace_id = $1", workspace_id
        )


async def test_hybrid_search_surfaces_a_keyword_only_and_a_vector_only_match(
    store, workspace_id
):
    """Prove genuine fusion, not an either/or fallback.

    ``doc_vector`` has an embedding identical to the query but shares no
    keywords with it; ``doc_keyword`` shares every keyword with the query but
    has an embedding orthogonal (maximally far) to it. Neither pure method
    alone (asked for only its single best result) would find the other's
    match -- hybrid_search's fused ranking must surface both.
    """
    query_embedding = _vec_dim(0)
    query_text = "roadmap review status"

    await store.upsert_segments(
        workspace_id=workspace_id,
        meeting_id="m1",
        segments=[
            _segment("doc-vector", "banana smoothie enjoyed by the whole team"),
            _segment("doc-keyword", "the roadmap review status meeting notes"),
        ],
        embeddings=[
            query_embedding,  # identical direction -> cosine distance 0
            _vec_dim(9),  # orthogonal -> cosine distance 1 (maximally far)
        ],
    )

    # Pure vector search (top_k=1) only finds the vector-close, keyword-blind doc.
    vector_only = await store.search(
        workspace_id=workspace_id,
        meeting_id=None,
        embedding=query_embedding,
        top_k=1,
    )
    assert [r.segment_id for r in vector_only] == ["doc-vector"]

    # Pure keyword search (top_k=1) only finds the keyword-matching, vector-far doc.
    keyword_only = await store.keyword_search(
        workspace_id=workspace_id,
        meeting_id=None,
        question=query_text,
        top_k=1,
    )
    assert [r.segment_id for r in keyword_only] == ["doc-keyword"]

    # Fused hybrid retrieval surfaces BOTH -- neither signal alone would have.
    fused = await store.hybrid_search(
        workspace_id=workspace_id,
        meeting_id=None,
        embedding=query_embedding,
        question=query_text,
        top_k=2,
    )
    assert {r.segment_id for r in fused} == {"doc-vector", "doc-keyword"}

    await _cleanup(store, workspace_id)


async def test_hybrid_search_respects_meeting_id_scope(store, workspace_id):
    await store.upsert_segments(
        workspace_id=workspace_id,
        meeting_id="m1",
        segments=[_segment("m1-doc", "quarterly okr update discussion")],
        embeddings=[_vec_dim(0)],
    )
    await store.upsert_segments(
        workspace_id=workspace_id,
        meeting_id="m2",
        segments=[_segment("m2-doc", "quarterly okr update discussion")],
        embeddings=[_vec_dim(0)],
    )

    fused = await store.hybrid_search(
        workspace_id=workspace_id,
        meeting_id="m1",
        embedding=_vec_dim(0),
        question="quarterly okr update",
        top_k=5,
    )

    assert [r.segment_id for r in fused] == ["m1-doc"]

    await _cleanup(store, workspace_id)
