"""Meeting highlights / clips / bookmarks.

Timestamped moments a user marks on a meeting — the flagship "clip / soundbite"
feature of tl;dv and Fathom — plus a cross-meeting highlights reel.

Public surface:
* :func:`extract_excerpt` — snapshot transcript text for a clip's time range.
* :class:`HighlightsRepo` — workspace-scoped persistence.
"""

from __future__ import annotations

from .excerpt import extract_excerpt
from .repo import HighlightsRepo

__all__ = ["extract_excerpt", "HighlightsRepo"]
