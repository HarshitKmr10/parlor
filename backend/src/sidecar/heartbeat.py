"""File-based heartbeat + bot-state reading.

The bot subprocess (Playwright for Teams/Meet, Zoom SDK for Zoom) doesn't
expose an HTTP server while it's busy in a meeting. Instead it touches
``/tmp/bot.heartbeat`` every few seconds and writes structured JSON to
``/tmp/bot-state.json`` whenever its internal state changes. The sidecar
reads those files to derive ``meeting_state`` for ``/health``.

This module intentionally has zero side effects beyond filesystem reads —
swap the paths via env vars in tests.
"""

from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Any, Dict, Optional

HEARTBEAT_PATH = Path(os.environ.get("BOT_HEARTBEAT_PATH", "/tmp/bot.heartbeat"))
BOT_STATE_PATH = Path(os.environ.get("BOT_STATE_PATH", "/tmp/bot-state.json"))


def read_heartbeat_age_seconds() -> Optional[float]:
    """Return seconds since the heartbeat file was last touched.

    Returns ``None`` when the file does not exist (bot has not started yet,
    or has been wiped between sessions). The caller treats ``None`` as
    "still configuring" rather than "stuck".
    """
    try:
        mtime = HEARTBEAT_PATH.stat().st_mtime
    except FileNotFoundError:
        return None
    except OSError:
        # Permissions / IO error — treat as missing so we don't flap to STUCK
        # on a transient filesystem hiccup. Errors are caller-visible via the
        # absent metric value rather than an exception.
        return None
    age = time.time() - mtime
    # Clamp negative values that can arise from clock skew between the bot
    # and sidecar processes on a single node.
    return max(age, 0.0)


def read_bot_state() -> Dict[str, Any]:
    """Read ``/tmp/bot-state.json`` if present, else return an empty dict.

    The bot is expected to write at minimum:

        {
          "state": "joining" | "admitted" | "ended",
          "last_segment_ts": "2025-05-26T10:11:12.000Z",
          "transcript_lag_ms": 320
        }

    Malformed JSON yields ``{}`` rather than raising — the bot may be in the
    middle of an atomic-replace write.
    """
    try:
        raw = BOT_STATE_PATH.read_text(encoding="utf-8")
    except FileNotFoundError:
        return {}
    except OSError:
        return {}
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    if not isinstance(parsed, dict):
        return {}
    return parsed
