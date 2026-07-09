"""Cross-meeting keyword search API (workspace-scoped).

  GET /api/v1/search?q=pricing&limit=20&offset=0

Deterministic keyword search over meeting titles, transcripts and summaries,
returning ranked meetings with highlighted snippets. Complements the semantic
RAG ``/ask`` path — use search to *find* meetings, ask to *reason* over one.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from ...search import SearchRepo, find_segment_matches, score_meeting
from ..database.connection import DatabaseConnection
from .deps import AuthContext, get_current_context, get_db
from .errors import ApiError
from .mappers import insights_from_row, segments_from_transcript
from .schemas import SearchResponse, SearchResultItem, SearchSnippet

router = APIRouter(prefix="/api/v1", tags=["search"])

_MIN_QUERY_LEN = 2
_MAX_SNIPPETS = 5
_CANDIDATE_LIMIT = 100


async def _repo(db: DatabaseConnection = Depends(get_db)) -> SearchRepo:
    return SearchRepo(db)


@router.get(
    "/search",
    response_model=SearchResponse,
    summary="Search meetings by keyword",
    description=(
        "Deterministic keyword search over meeting titles, transcripts, and "
        "summaries within the workspace, returning ranked meetings with "
        "highlighted snippets. Complements the semantic RAG `/ask` "
        "endpoint — use search to find meetings, ask to reason over one."
    ),
)
async def search_meetings(
    q: str = Query(..., min_length=_MIN_QUERY_LEN, max_length=200),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    ctx: AuthContext = Depends(get_current_context),
    repo: SearchRepo = Depends(_repo),
) -> SearchResponse:
    query = q.strip()
    if len(query) < _MIN_QUERY_LEN:
        raise ApiError(400, "query_too_short", "Search query must be at least 2 chars")

    candidates = await repo.search_candidates(
        ctx.workspace.id, query, limit=_CANDIDATE_LIMIT
    )

    results: list[SearchResultItem] = []
    for row in candidates:
        title = row.get("title") or ""
        segments = segments_from_transcript(row.get("transcript"))
        snippets, transcript_hits = find_segment_matches(
            segments, query, max_snippets=_MAX_SNIPPETS
        )

        insights = insights_from_row(row.get("insights"))
        summary = insights.summary if insights else ""

        score = score_meeting(
            transcript_hits=transcript_hits,
            title=title,
            summary=summary,
            query=query,
        )
        if score <= 0:
            continue  # matched only on speaker/metadata noise from the pre-filter

        results.append(
            SearchResultItem(
                meeting_id=str(row.get("id")),
                title=title or None,
                score=score,
                matched_segments=len(snippets),
                title_match=query.lower() in title.lower(),
                summary_match=bool(summary) and query.lower() in summary.lower(),
                snippets=[SearchSnippet.model_validate(s) for s in snippets],
            )
        )

    results.sort(key=lambda r: r.score, reverse=True)
    total = len(results)
    page = results[offset : offset + limit]
    return SearchResponse(query=query, items=page, total=total)
