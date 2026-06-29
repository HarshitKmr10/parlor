"""Meeting comments + @mentions — the collaboration/review layer.

Threaded comments on a meeting, optionally anchored to a timestamp or transcript
segment. @mentions are validated against workspace membership so a comment can
never tag (or later notify) someone outside the workspace.
"""

from __future__ import annotations

from .repo import CommentsRepo

__all__ = ["CommentsRepo"]
