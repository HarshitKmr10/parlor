"""Pure decision helpers for auto-join preferences (no I/O, unit-tested).

The calendar poller consults these before dispatching a bot for a calendar
event so a workspace can turn auto-join off entirely, or silence a specific
platform, without touching the poller's control flow.
"""

from __future__ import annotations

from typing import Any, Dict

# Map PlatformDetector identifiers → the per-platform toggle column.
_PLATFORM_TOGGLE = {
    "zoom": "join_zoom",
    "googlemeet": "join_meet",
    "msteams": "join_teams",
}


def should_skip_platform(prefs: Dict[str, Any], platform: str) -> bool:
    """True when auto-join should be skipped for ``platform`` given ``prefs``.

    - Auto-join disabled entirely → skip everything.
    - A known platform whose toggle is off → skip.
    - An unknown/undetectable platform → never skip (fail-open).
    """
    if not prefs.get("auto_join_enabled", True):
        return True
    toggle = _PLATFORM_TOGGLE.get(platform)
    if toggle is None:
        return False
    return not prefs.get(toggle, True)
