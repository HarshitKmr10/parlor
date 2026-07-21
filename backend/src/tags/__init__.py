"""Meeting tags (workspace-defined name + color labels).

`TagsRepo` persists tag definitions and their per-meeting assignments. Tags are
workspace-scoped; the meeting_tags join table maps meetings to tags.
"""

from .repo import TagsRepo

__all__ = ["TagsRepo"]
