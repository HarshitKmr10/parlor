"""Pydantic request/response schemas for the meeting-worker sidecar HTTP API.

These models define the wire contract between the meeting-joiner API (which
drives bot lifecycle) and the sidecar (which runs alongside the bot in each
meeting-worker pod). All payloads are JSON; ``HttpUrl`` validation ensures
URLs are well-formed before we spend time launching a subprocess.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, HttpUrl

# Supported meeting platforms. Anything outside this set is rejected with HTTP
# 422 by FastAPI's request validation, so the sidecar never tries to spawn an
# unknown subprocess.
Platform = Literal["msteams", "googlemeet", "zoom"]

# Lifecycle states surfaced through ``/health`` for the warm pool reaper to
# act on. ``stuck`` is a derived state (bot alive but heartbeat stale).
MeetingStateLiteral = Literal[
    "warm",
    "configuring",
    "joining",
    "in_meeting",
    "ended",
    "stuck",
]


class ConfigureRequest(BaseModel):
    """Payload to start a bot in the current pod.

    ``meeting_id`` doubles as the idempotency key: a duplicate ``/configure``
    with the same ID against an already-configured pod is rejected with HTTP
    409 by the route handler.
    """

    meeting_id: str
    meeting_url: HttpUrl
    org_id: str
    platform: Platform
    bot_name: str = "Meeting Bot"
    bot_avatar_url: Optional[HttpUrl] = None
    transcript_source: Optional[str] = None
    session_number: int = Field(default=1, ge=1)
    webhook_url: Optional[HttpUrl] = None
    max_duration_seconds: Optional[int] = Field(default=None, ge=1)
    # The Google Workspace account the bot signs in as for auto-admission to
    # internal Meet meetings. Selects the per-account storageState from the
    # pooled auth dir (<GOOGLE_AUTH_STATE_DIR>/<email>.json). Mirrors the
    # standalone LocalBotRunner.notetaker_email plumbing. None → anonymous guest.
    notetaker_email: Optional[str] = None
    # Optional explicit storageState (auth) file path. When set it wins over the
    # pooled <DIR>/<email>.json resolution. Holds live session cookies — mount
    # read-only and keep it out of source control.
    google_auth_state_path: Optional[str] = None


class ConfigureResponse(BaseModel):
    """Immediate ACK; the bot keeps booting in the background."""

    accepted: bool
    meeting_id: str
    pid: int


class ConfigureConflictResponse(BaseModel):
    """Returned with HTTP 409 when the pod is not in ``warm`` state."""

    accepted: bool = False
    meeting_id: str
    current_state: MeetingStateLiteral
    detail: str


class AbortRequest(BaseModel):
    """Payload to gracefully terminate the running bot subprocess."""

    reason: str = "client_requested"
    grace_seconds: int = Field(default=45, ge=1, le=600)


class AbortResponse(BaseModel):
    """Returned once the subprocess has actually exited (or been SIGKILLed)."""

    exit_reason: str
    exit_code: Optional[int]


class HealthResponse(BaseModel):
    """Snapshot of the pod's state. Polled frequently by the reaper."""

    meeting_state: MeetingStateLiteral
    current_meeting_id: Optional[str] = None
    current_session_number: Optional[int] = None
    last_segment_ts: Optional[datetime] = None
    transcript_lag_ms: Optional[int] = None
    bot_subprocess_alive: bool
    rss_mb: Optional[int] = None
    # Real timestamp of the bot's last heartbeat-file touch (None when the
    # bot never wrote one). MUST reflect the file, not "now" — the reaper's
    # ended/stuck grace math depends on this aging once the bot dies.
    last_heartbeat_ts: Optional[datetime] = None


class RootResponse(BaseModel):
    """Tiny identity payload served from ``/``."""

    service: str
    version: str
    uptime_seconds: float
