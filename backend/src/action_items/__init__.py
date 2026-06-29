"""First-class action items / tasks promoted out of the insights JSON.

AI-extracted and manually-added tasks become trackable rows with assignee, due
date and done state, plus a cross-meeting "my tasks" view. AI items dedupe per
meeting by a hash of their normalized text, so re-summarizing is idempotent and
never clobbers a user's edits.

Public surface:
* :func:`dedupe_key` / :func:`dedupe_ai_items` — pure normalization.
* :class:`ActionItemsRepo` — workspace-scoped persistence + AI upsert.
"""

from __future__ import annotations

from .dedupe import dedupe_ai_items, dedupe_key
from .repo import ActionItemsRepo

__all__ = ["dedupe_key", "dedupe_ai_items", "ActionItemsRepo"]
