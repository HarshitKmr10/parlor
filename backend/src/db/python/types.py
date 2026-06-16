"""Frozen dataclass mirroring the meeting_joiner row shape.

Returned by both adapters so call sites can rely on attribute access
rather than dict access (and so the Prisma model's quirks don't leak
into raw-SQL callers).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional


@dataclass(frozen=True)
class MeetingRow:
    id: str
    meeting_url: str
    normalized_meeting_url: Optional[str]
    status: str
    video_link: Optional[str]
    transcript: Optional[Any]
    participants: Optional[Any]
    org_id: Optional[str]
    meeting_id: Optional[str]
    bot_join_time: Optional[datetime]
    bot_leave_time: Optional[datetime]
    bot_name: Optional[str]
    transcript_source: Optional[str]
    exit_reason: Optional[str]
    exit_details: Optional[Any]
    # process_id removed in the pod-per-meeting refactor; pod_name +
    # cluster_name + last_heartbeat_at replace it. Kept as a Pydantic
    # default-None field so older callers don't break if they reference it.
    pod_name: Optional[str]
    cluster_name: Optional[str]
    last_heartbeat_at: Optional[datetime]
    original_meeting_id: Optional[str]
    is_duplicate: bool
    # When set, the bot is dispatched at this time by the meeting-scheduler
    # poller (status sits at 'scheduled' until then). None = dispatch now.
    scheduled_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    # Optional relation hydration — populated by find_unique_with_relations.
    # Kept off the frozen surface via __init__=False so equality/hash don't
    # see relations. Use dataclasses.replace to set them.
    org: Optional[dict] = field(default=None)
    meeting: Optional[dict] = field(default=None)
    original_meeting: Optional["MeetingRow"] = field(default=None)
    duplicates: tuple = field(default_factory=tuple)
