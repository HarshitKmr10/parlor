"""Saved views — named, reusable saved searches (workspace-scoped).

`SavedViewsRepo` persists named searches (a query string plus optional
structured filters) so operators can re-run a common search with one click
instead of retyping the query and re-applying filters each time.
"""

from .repo import SavedViewsRepo

__all__ = ["SavedViewsRepo"]
