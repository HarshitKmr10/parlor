"""Reciprocal Rank Fusion (RRF) for combining ranked retrieval results.

Hybrid retrieval needs to combine two rankings that live on incomparable
scales: vector search ranks by cosine *distance* (unbounded, embedding-model
dependent) while keyword search (``EmbeddingStore.keyword_search``) ranks by
an ILIKE-keyword-hit *count* (a small integer, higher-is-better -- the
opposite direction of distance). Normalizing and blending those two scores
directly would require picking an arbitrary weighting.

RRF sidesteps that entirely by using only each document's *rank position*
within its own list, not its score::

    score(doc) = sum_over_lists( 1 / (k + rank_in_list) )

A document need not appear in every list to be scored -- absence from a list
simply contributes 0 for that list. That's what makes this genuine fusion
rather than an either/or fallback: a keyword-only hit and a vector-only hit
both surface in the fused ranking, ordered by whichever signal(s) found them.

``k`` dampens the influence of top ranks so a single list's #1 hit doesn't
dominate purely because it happened to be ranked first; ``RRF_K = 60`` is the
constant from the original paper (Cormack, Clarke & Buettcher, SIGIR 2009,
"Reciprocal Rank Fusion Outperforms Condorcet and Individual Rank Learning
Methods") and is what most production hybrid-search implementations (Zep/
Graphiti, Letta, Elasticsearch's RRF retriever) use unchanged rather than
re-tuning per corpus -- see docs/TWIN-CENTRIC-REDESIGN.md §2.4/§2.5.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .store import RetrievedSegment

# Standard default from the original RRF paper. Not re-tuned here -- see the
# module docstring for why the standard value is used as-is.
RRF_K = 60


def _segment_key(segment: "RetrievedSegment") -> tuple[str, str]:
    """Identity for a retrieved row across ranked lists.

    ``(meeting_id, segment_id)`` -- not ``segment_id`` alone, which repeats
    across meetings. This matches the table's real uniqueness constraint,
    ``UNIQUE (workspace_id, meeting_id, segment_id)``; workspace_id is already
    fixed per query so it doesn't need to be part of the fusion key.
    """
    return (segment.meeting_id, segment.segment_id)


def reciprocal_rank_fusion(
    *ranked_lists: list["RetrievedSegment"],
    k: int = RRF_K,
    top_k: int | None = None,
) -> list["RetrievedSegment"]:
    """Fuse ranked lists of ``RetrievedSegment`` into one ranking via RRF.

    Each list is assumed already sorted best-first (rank 1 = first element).
    Ties in fused score are broken by the order results are first
    encountered (stable sort), which in practice means "whichever list
    ranked it highest, considered in the order lists were passed in" --
    fine for retrieval, where an exact tie-break order rarely matters.

    Returns the fused list, truncated to ``top_k`` if given.
    """
    scores: dict[tuple[str, str], float] = {}
    representative: dict[tuple[str, str], "RetrievedSegment"] = {}

    for ranked_list in ranked_lists:
        for rank, segment in enumerate(ranked_list, start=1):
            key = _segment_key(segment)
            scores[key] = scores.get(key, 0.0) + 1.0 / (k + rank)
            representative.setdefault(key, segment)

    fused = sorted(
        representative.values(),
        key=lambda segment: scores[_segment_key(segment)],
        reverse=True,
    )
    return fused[:top_k] if top_k is not None else fused
