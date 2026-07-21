"""Prompt library — reusable saved Ask prompts (workspace-scoped).

`SavedPromptsRepo` persists named, reusable prompt bodies that operators save
once and reuse in the workspace-wide Ask feature instead of retyping them.
"""

from .repo import SavedPromptsRepo

__all__ = ["SavedPromptsRepo"]
