"""Per-workspace sharing defaults for public meeting share links.

`ShareSettingsRepo` persists the default share-link expiry (hours; 0 = never),
whether a passcode is required, and the default passcode to seed. One row per
workspace.
"""

from .repo import DEFAULTS, ShareSettingsRepo

__all__ = ["ShareSettingsRepo", "DEFAULTS"]
