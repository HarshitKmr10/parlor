"""Map internal meeting_joiner rows to the contract's product `Meeting`."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from ...shared.platformDetector import PlatformDetector
from ..models.schemas import MeetingRecord
from .schemas import (
    ActionItem,
    Chapter,
    Meeting,
    MeetingInsights,
    Participant,
    TranscriptSegment,
)

# Internal joiner platform tokens -> contract platform tokens.
_PLATFORM_MAP = {
    "msteams": "teams",
    "teams": "teams",
    "googlemeet": "meet",
    "meet": "meet",
    "zoom": "zoom",
}

# Internal meeting_joiner status -> contract status. The internal model has
# extra states (not_joined, interrupted) that collapse onto the public set.
_STATUS_MAP = {
    "not_joined": "scheduled",
    "scheduled": "scheduled",
    "joining": "joining",
    "ongoing": "ongoing",
    "interrupted": "ongoing",
    "completed": "completed",
    "failed": "failed",
}


def _platform(meeting_url: str) -> Optional[str]:
    detected = PlatformDetector.detect_platform(meeting_url)
    return _PLATFORM_MAP.get(detected)


def _duration_sec(start: Optional[datetime], end: Optional[datetime]) -> Optional[int]:
    if not start or not end:
        return None
    return int((end - start).total_seconds())


def _participants(raw: Optional[list[dict[str, Any]]]) -> list[Participant]:
    if not raw:
        return []
    out: list[Participant] = []
    for i, p in enumerate(raw):
        if not isinstance(p, dict):
            continue
        out.append(
            Participant(
                id=str(p.get("id") or f"participant-{i}"),
                name=str(p.get("name") or "Unknown"),
                email=p.get("email"),
                joined_at=p.get("joinedAt") or p.get("joined_at"),
                left_at=p.get("leftAt") or p.get("left_at"),
            )
        )
    return out


def _has_recording(record: MeetingRecord) -> bool:
    return bool(record.video_link)


def to_meeting(record: MeetingRecord, *, title: Optional[str] = None) -> Meeting:
    status = _STATUS_MAP.get(record.status.value, "scheduled")
    transcript = record.transcript if isinstance(record.transcript, dict) else {}
    has_summary = bool(transcript.get("summary")) if transcript else False
    return Meeting(
        id=record.id,
        workspace_id=None,
        title=title,
        platform=_platform(record.meeting_url),
        meeting_url=record.meeting_url,
        status=status,  # type: ignore[arg-type]
        scheduled_at=record.scheduled_at,
        started_at=record.bot_join_time,
        ended_at=record.bot_leave_time,
        duration_sec=_duration_sec(record.bot_join_time, record.bot_leave_time),
        participants=_participants(record.participants),
        has_summary=has_summary,
        has_recording=_has_recording(record),
        created_at=record.created_at,
    )


def segments_from_transcript(
    transcript: Optional[dict[str, Any]],
) -> list[TranscriptSegment]:
    """Project the internal transcript JSON `content` list into segments."""
    if not transcript or not isinstance(transcript, dict):
        return []
    content = transcript.get("content")
    if not isinstance(content, list):
        return []
    segments: list[TranscriptSegment] = []
    for i, item in enumerate(content):
        if not isinstance(item, dict):
            continue
        text = item.get("text") or item.get("content") or ""
        if not text:
            continue
        start = item.get("startTime") or item.get("start_time") or 0
        end = item.get("endTime") or item.get("end_time") or start
        segments.append(
            TranscriptSegment(
                id=str(item.get("id") or f"seg-{i}"),
                speaker_id=item.get("speakerId") or item.get("speaker_id"),
                speaker_name=str(item.get("speaker") or "Unknown"),
                text=str(text),
                t_start_sec=float(start or 0),
                t_end_sec=float(end or 0),
                created_at=item.get("timestamp"),
            )
        )
    return segments


def insights_from_row(raw: Any) -> Optional[MeetingInsights]:
    """Parse a stored ``insights`` JSON blob into the typed model."""
    if not raw or not isinstance(raw, dict):
        return None
    return MeetingInsights(
        summary=raw.get("summary", "") or "",
        key_points=list(raw.get("keyPoints") or raw.get("key_points") or []),
        action_items=[
            ActionItem.model_validate(a)
            for a in (raw.get("actionItems") or raw.get("action_items") or [])
            if isinstance(a, dict)
        ],
        chapters=[
            Chapter.model_validate(c)
            for c in (raw.get("chapters") or [])
            if isinstance(c, dict)
        ],
    )
