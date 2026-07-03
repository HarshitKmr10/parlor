"""pgvector-backed embedding store using asyncpg.

The table and extension are created idempotently at startup. Vectors are stored
in a ``vector(N)`` column with an ivfflat cosine index. Search is workspace
scoped, optionally narrowed to a single meeting.

If ``DATABASE_URL`` is unset the store runs in a degraded "unavailable" state:
``/embed`` and ``/chat`` RAG return clear errors, but ``/summarize`` and the
service itself keep working.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass

import asyncpg

from ..config import EMBEDDING_DIM, HYBRID_CANDIDATE_MULTIPLIER, IVFFLAT_LISTS
from ..schemas import TranscriptSegment
from .fusion import reciprocal_rank_fusion

logger = logging.getLogger("ai-service.store")

_CREATE_EXTENSION = "CREATE EXTENSION IF NOT EXISTS vector;"

_CREATE_TABLE = f"""
CREATE TABLE IF NOT EXISTS meeting_embeddings (
    id            BIGSERIAL PRIMARY KEY,
    workspace_id  TEXT        NOT NULL,
    meeting_id    TEXT        NOT NULL,
    segment_id    TEXT        NOT NULL,
    speaker_name  TEXT        NOT NULL DEFAULT '',
    text          TEXT        NOT NULL,
    t_start_sec   DOUBLE PRECISION NOT NULL DEFAULT 0,
    embedding     vector({EMBEDDING_DIM}) NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, meeting_id, segment_id)
);
"""

_CREATE_INDEX = f"""
CREATE INDEX IF NOT EXISTS meeting_embeddings_embedding_idx
    ON meeting_embeddings USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = {IVFFLAT_LISTS});
"""

_CREATE_SCOPE_INDEX = """
CREATE INDEX IF NOT EXISTS meeting_embeddings_scope_idx
    ON meeting_embeddings (workspace_id, meeting_id);
"""


def _to_vector_literal(vec: list[float]) -> str:
    """Render an embedding as a pgvector text literal: ``[1,2,3]``."""
    return "[" + ",".join(repr(float(x)) for x in vec) + "]"


@dataclass
class RetrievedSegment:
    segment_id: str
    speaker_name: str
    text: str
    t_start_sec: float
    distance: float
    meeting_id: str = ""


class EmbeddingStore:
    def __init__(self, database_url: str | None) -> None:
        self._database_url = database_url
        self._pool: asyncpg.Pool | None = None

    @property
    def configured(self) -> bool:
        return bool(self._database_url)

    @property
    def ready(self) -> bool:
        return self._pool is not None

    async def init(self) -> None:
        """Connect and create extension/table/index idempotently."""
        if not self._database_url:
            logger.warning("DATABASE_URL not set; embedding store unavailable")
            return
        try:
            self._pool = await asyncpg.create_pool(
                self._database_url, min_size=1, max_size=5
            )
            async with self._pool.acquire() as conn:
                await conn.execute(_CREATE_EXTENSION)
                await conn.execute(_CREATE_TABLE)
                await conn.execute(_CREATE_INDEX)
                await conn.execute(_CREATE_SCOPE_INDEX)
            logger.info("embedding store ready (pgvector)")
        except Exception as exc:  # connection refused, auth, missing extension
            logger.error("embedding store init failed: %s", exc)
            pool, self._pool = self._pool, None
            if pool is not None:
                await pool.close()

    async def close(self) -> None:
        if self._pool is not None:
            await self._pool.close()
            self._pool = None

    async def upsert_segments(
        self,
        *,
        workspace_id: str,
        meeting_id: str,
        segments: list[TranscriptSegment],
        embeddings: list[list[float]],
    ) -> int:
        """Insert or update per-segment embeddings. Returns count written."""
        if self._pool is None:
            raise RuntimeError("embedding store not available")
        if len(segments) != len(embeddings):
            raise ValueError("segments and embeddings length mismatch")

        rows = [
            (
                workspace_id,
                meeting_id,
                seg.id,
                seg.speaker_name,
                seg.text,
                float(seg.t_start_sec),
                _to_vector_literal(emb),
            )
            for seg, emb in zip(segments, embeddings)
        ]

        query = """
            INSERT INTO meeting_embeddings
                (workspace_id, meeting_id, segment_id, speaker_name, text,
                 t_start_sec, embedding)
            VALUES ($1, $2, $3, $4, $5, $6, $7::vector)
            ON CONFLICT (workspace_id, meeting_id, segment_id)
            DO UPDATE SET
                speaker_name = EXCLUDED.speaker_name,
                text         = EXCLUDED.text,
                t_start_sec  = EXCLUDED.t_start_sec,
                embedding    = EXCLUDED.embedding,
                created_at   = now();
        """
        async with self._pool.acquire() as conn:
            await conn.executemany(query, rows)
        return len(rows)

    async def search(
        self,
        *,
        workspace_id: str,
        meeting_id: str | None,
        embedding: list[float],
        top_k: int,
    ) -> list[RetrievedSegment]:
        """Cosine-nearest segments, workspace-scoped."""
        if self._pool is None:
            raise RuntimeError("embedding store not available")

        vector_literal = _to_vector_literal(embedding)

        if meeting_id is not None:
            query = """
                SELECT meeting_id, segment_id, speaker_name, text, t_start_sec,
                       embedding <=> $2::vector AS distance
                FROM meeting_embeddings
                WHERE workspace_id = $1 AND meeting_id = $3
                ORDER BY embedding <=> $2::vector
                LIMIT $4;
            """
            args = [workspace_id, vector_literal, meeting_id, top_k]
        else:
            query = """
                SELECT meeting_id, segment_id, speaker_name, text, t_start_sec,
                       embedding <=> $2::vector AS distance
                FROM meeting_embeddings
                WHERE workspace_id = $1
                ORDER BY embedding <=> $2::vector
                LIMIT $3;
            """
            args = [workspace_id, vector_literal, top_k]

        async with self._pool.acquire() as conn:
            records = await conn.fetch(query, *args)

        return [
            RetrievedSegment(
                meeting_id=r["meeting_id"],
                segment_id=r["segment_id"],
                speaker_name=r["speaker_name"],
                text=r["text"],
                t_start_sec=float(r["t_start_sec"]),
                distance=float(r["distance"]),
            )
            for r in records
        ]

    async def keyword_search(
        self,
        *,
        workspace_id: str,
        meeting_id: str | None,
        question: str,
        top_k: int,
    ) -> list[RetrievedSegment]:
        """Fallback ILIKE keyword search (used by mock chat).

        Ranks rows by how many query keywords appear in the segment text.
        """
        if self._pool is None:
            raise RuntimeError("embedding store not available")

        import re

        keywords = [w for w in re.findall(r"[A-Za-z]{3,}", question.lower())][:8]
        if not keywords:
            keywords = [question.lower()]

        # Build a score = sum of ILIKE matches.
        score_terms = " + ".join(
            f"(CASE WHEN lower(text) LIKE ${i + 2} THEN 1 ELSE 0 END)"
            for i in range(len(keywords))
        )
        like_params = [f"%{kw}%" for kw in keywords]

        if meeting_id is not None:
            query = f"""
                SELECT meeting_id, segment_id, speaker_name, text, t_start_sec,
                       ({score_terms}) AS score
                FROM meeting_embeddings
                WHERE workspace_id = $1 AND meeting_id = ${len(keywords) + 2}
                ORDER BY score DESC, t_start_sec ASC
                LIMIT ${len(keywords) + 3};
            """
            args = [workspace_id, *like_params, meeting_id, top_k]
        else:
            query = f"""
                SELECT meeting_id, segment_id, speaker_name, text, t_start_sec,
                       ({score_terms}) AS score
                FROM meeting_embeddings
                WHERE workspace_id = $1
                ORDER BY score DESC, t_start_sec ASC
                LIMIT ${len(keywords) + 2};
            """
            args = [workspace_id, *like_params, top_k]

        async with self._pool.acquire() as conn:
            records = await conn.fetch(query, *args)

        # distance proxy: lower is better, so invert the score.
        return [
            RetrievedSegment(
                meeting_id=r["meeting_id"],
                segment_id=r["segment_id"],
                speaker_name=r["speaker_name"],
                text=r["text"],
                t_start_sec=float(r["t_start_sec"]),
                distance=1.0 / (1.0 + float(r["score"])),
            )
            for r in records
            if float(r["score"]) > 0
        ]

    async def hybrid_search(
        self,
        *,
        workspace_id: str,
        meeting_id: str | None,
        embedding: list[float],
        question: str,
        top_k: int,
        candidate_k: int | None = None,
    ) -> list[RetrievedSegment]:
        """Hybrid retrieval: fuse vector similarity + keyword ranking via RRF.

        This is the default retrieval path -- not an either/or fallback. It
        runs the existing cosine-distance ``search`` and ILIKE-based
        ``keyword_search`` independently, each over the *same*
        workspace/meeting scope (the scope filter is applied identically to
        both underlying queries so hybrid retrieval can't leak across
        tenants by only filtering one side), then fuses their rankings with
        Reciprocal Rank Fusion (see ``fusion.reciprocal_rank_fusion``).

        Each underlying query is asked for ``candidate_k`` results (default:
        ``top_k * HYBRID_CANDIDATE_MULTIPLIER``) rather than just ``top_k``,
        so a document ranked outside the final ``top_k`` on one signal alone
        still has a chance to be pulled into the fused top ``top_k`` by the
        other signal.
        """
        if self._pool is None:
            raise RuntimeError("embedding store not available")

        pool_size = candidate_k or max(top_k * HYBRID_CANDIDATE_MULTIPLIER, top_k)

        vector_results, keyword_results = await asyncio.gather(
            self.search(
                workspace_id=workspace_id,
                meeting_id=meeting_id,
                embedding=embedding,
                top_k=pool_size,
            ),
            self.keyword_search(
                workspace_id=workspace_id,
                meeting_id=meeting_id,
                question=question,
                top_k=pool_size,
            ),
        )

        return reciprocal_rank_fusion(vector_results, keyword_results, top_k=top_k)
