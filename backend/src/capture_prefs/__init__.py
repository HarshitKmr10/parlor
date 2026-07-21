"""Per-workspace auto-join preferences for calendar capture.

`CapturePrefsRepo` persists the master auto-join switch, the join lead time
(minutes), and per-platform toggles (Zoom / Google Meet / Microsoft Teams).
One row per workspace. `should_skip_platform` is the pure decision the calendar
auto-join poller consults before dispatching a bot for an upcoming event.
"""

from .prefs import should_skip_platform
from .repo import DEFAULTS, CapturePrefsRepo

__all__ = ["CapturePrefsRepo", "DEFAULTS", "should_skip_platform"]
