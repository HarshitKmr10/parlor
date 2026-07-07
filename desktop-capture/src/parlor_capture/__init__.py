"""Parlor botless desktop capture client.

Captures the local machine's system/meeting audio (Granola-style — no bot
joins the call), transcribes it, and streams transcript segments to the
Parlor backend so the transcript/summary flow works without a server-side
bot. This complements the server-side joiner bots; it does not replace them.
"""

from __future__ import annotations

__version__ = "0.1.0"
