"""Per-user notification quiet hours: a daily do-not-notify window.

`QuietHoursRepo` persists whether quiet hours are on plus the start/end hour
(0..23) of a daily window during which notification/digest emails are
suppressed. The window may wrap midnight. One row per (workspace, user).
"""

from .repo import DEFAULTS, QuietHoursRepo, is_quiet, is_quiet_now

__all__ = ["QuietHoursRepo", "DEFAULTS", "is_quiet", "is_quiet_now"]
