"""Lightweight required-key validator for the standalone bundle.

Run from process startup (main.py, worker entrypoints) so a misconfigured
deployment fails before opening a browser or hitting the queue.
"""

from __future__ import annotations

import os
import sys
from typing import Final

REQUIRED: Final[tuple[str, ...]] = ("DATABASE_URL",)

PLATFORM_REQUIRED: Final[dict[str, tuple[str, ...]]] = {
    "zoom": ("ZOOM_APP_CLIENT_ID", "ZOOM_APP_CLIENT_SECRET"),
}


def assert_required() -> None:
    missing = [k for k in REQUIRED if not os.environ.get(k) or os.environ.get(k) == "<REQUIRED>"]
    if not missing:
        return
    sys.stderr.write(
        f"\n❌ meeting-joiner: missing required env keys: {', '.join(missing)}\n"
        f"   See meeting-joiner/.env.example for the full env contract.\n\n"
    )
    sys.exit(1)


def warn_missing_for_platform(platform: str) -> None:
    keys = PLATFORM_REQUIRED.get(platform)
    if not keys:
        return
    missing = [k for k in keys if not os.environ.get(k)]
    if not missing:
        return
    sys.stderr.write(
        f"[meeting-joiner] platform={platform} missing optional keys: {', '.join(missing)}. "
        f"Bot will not be able to join {platform} meetings until they are set.\n"
    )
