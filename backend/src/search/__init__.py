"""Cross-meeting keyword search.

Complements the semantic RAG "ask" path with deterministic keyword search over
meeting titles, transcripts and summaries — the "find every meeting where we
said X" feature every top meeting tool ships (Fireflies, Otter, tl;dv).

Public surface:
* :func:`find_segment_matches` — pure snippet extraction for a query.
* :func:`score_meeting` — rank a meeting against a query.
* :class:`SearchRepo` — workspace-scoped candidate fetch.
"""

from __future__ import annotations

from .repo import SearchRepo
from .snippets import find_segment_matches, make_snippet, score_meeting

__all__ = ["SearchRepo", "find_segment_matches", "make_snippet", "score_meeting"]
