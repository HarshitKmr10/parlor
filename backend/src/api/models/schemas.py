"""
Pydantic models for API request and response schemas
"""

import os
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator


class MeetingStatus(str, Enum):
    NOT_JOINED = "not_joined"
    SCHEDULED = "scheduled"  # Awaiting timed dispatch by the scheduler poller
    JOINING = "joining"  # Pod claimed + sidecar configured, bot launching
    ONGOING = "ongoing"  # Bot admitted into the meeting
    INTERRUPTED = "interrupted"  # Recoverable drop; rejoin orchestrator owns this
    COMPLETED = "completed"
    FAILED = "failed"  # Terminal non-recoverable error


class TranscriptFormat(str, Enum):
    DETAILED = "detailed"
    SIMPLE = "simple"
    RAW = "raw"
    TEXT_ONLY = "text_only"


TranscriptSource = Literal["audio_asr", "gmeet_captions", "teams_captions"]


# Request Models
class MeetingCreateRequest(BaseModel):
    """Request model for creating a new meeting"""

    meeting_url: HttpUrl = Field(..., description="Microsoft Teams meeting URL")
    org_id: Optional[str] = Field(None, description="Organization ID")
    bot_name: Optional[str] = Field(
        "Meeting Bot",
        description="Custom name for the meeting bot",
        max_length=100,
    )
    # Picked once at meeting creation time; the bot worker honors
    # whichever value lands here when it dispatches the platform bot.
    # null is intentionally accepted and means "use the platform's
    # default". For Teams, null is resolved at creation time from
    # MSTEAMS_TRANSCRIPT_SOURCE when that env var is set. The toggle on
    # the dashboard's "Dispatch a meeting bot" form sets this; CLI / API
    # callers can also pass it directly.
    transcript_source: Optional[TranscriptSource] = Field(
        None,
        description=(
            "Transcript source for the bot. 'audio_asr' = per-peer "
            "audio + AWS/Azure streaming (highest accuracy). "
            "'gmeet_captions' = scrape Google Meet's live captions "
            "(free, Meet only). 'teams_captions' = use "
            "Teams platform captions (Teams only). Null = platform "
            "default; for Teams this honors MSTEAMS_TRANSCRIPT_SOURCE."
        ),
    )
    scheduled_at: Optional[datetime] = Field(
        None,
        description=(
            "When set, the bot is dispatched automatically at this time "
            "instead of immediately. Must be a timezone-aware ISO 8601 "
            "timestamp in the future. Null = dispatch now."
        ),
    )

    @field_validator("scheduled_at")
    @classmethod
    def _validate_scheduled_at(
        cls, value: Optional[datetime]
    ) -> Optional[datetime]:
        if value is None:
            return None
        # Reject naive datetimes — a bare local time is ambiguous and would
        # be compared against a UTC `now()` in the scheduler.
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError(
                "scheduled_at must include a timezone offset (e.g. "
                "'2026-06-05T15:00:00Z')"
            )
        now = datetime.now(timezone.utc)
        if value <= now:
            raise ValueError("scheduled_at must be in the future")
        horizon_days = int(
            os.environ.get("MEETING_MAX_SCHEDULE_HORIZON_DAYS", "30")
        )
        if value > now + timedelta(days=horizon_days):
            raise ValueError(
                f"scheduled_at cannot be more than {horizon_days} days ahead"
            )
        return value

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "meeting_url": "https://teams.microsoft.com/l/meetup-join/...",
                    "org_id": "550e8400-e29b-41d4-a716-446655440000",
                    "bot_name": "Teams Bot",
                    "transcript_source": "audio_asr",
                },
                {
                    "meeting_url": "https://meet.google.com/abc-defg-hij",
                    "org_id": "550e8400-e29b-41d4-a716-446655440000",
                    "bot_name": "Meet Bot",
                    "transcript_source": "gmeet_captions",
                },
            ]
        }
    )


# Response Models
class MeetingCreateResponse(BaseModel):
    """Response model for meeting creation"""

    meeting_id: str = Field(..., description="Unique meeting identifier")
    status: MeetingStatus = Field(..., description="Current meeting status")
    queued_at: datetime = Field(..., description="When the meeting was queued")
    message: str = Field(..., description="Status message")
    is_duplicate: bool = Field(
        False, description="Whether this request was linked to an existing ongoing meeting"
    )
    original_meeting_id: Optional[str] = Field(
        None, description="ID of the original meeting if this is a duplicate request"
    )
    scheduled_at: Optional[datetime] = Field(
        None,
        description="When the bot is scheduled to be dispatched (null if immediate)",
    )

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "meeting_id": "550e8400-e29b-41d4-a716-446655440000",
                    "status": "not_joined",
                    "queued_at": "2023-12-01T10:00:00Z",
                    "message": "Meeting created and queued for processing",
                    "is_duplicate": False,
                    "original_meeting_id": None,
                },
                {
                    "meeting_id": "660f9511-f30c-52e5-b827-557766551111",
                    "status": "ongoing",
                    "queued_at": "2023-12-01T10:05:00Z",
                    "message": "Linked to existing ongoing meeting - transcripts will be provided from request time onwards",
                    "is_duplicate": True,
                    "original_meeting_id": "550e8400-e29b-41d4-a716-446655440000",
                },
            ]
        }
    )


class MeetingStatusResponse(BaseModel):
    """Response model for meeting status"""

    meeting_id: str = Field(..., description="Unique meeting identifier")
    status: MeetingStatus = Field(..., description="Current meeting status")
    meeting_url: str = Field(..., description="Original meeting URL")
    platform: Optional[str] = Field(
        None, description="Meeting platform (zoom, msteams, etc.)"
    )
    created_at: datetime = Field(..., description="Meeting creation timestamp")
    bot_join_time: Optional[datetime] = Field(
        None, description="When bot joined the meeting"
    )
    bot_leave_time: Optional[datetime] = Field(
        None, description="When bot left the meeting"
    )
    participant_count: int = Field(0, description="Number of participants")
    transcript_entries: int = Field(0, description="Number of transcript entries")
    video_link: Optional[str] = Field(None, description="URL to recorded video")
    org_id: Optional[str] = Field(None, description="Organization ID")
    is_duplicate: bool = Field(
        False, description="Whether this is linked to an existing ongoing meeting"
    )
    original_meeting_id: Optional[str] = Field(
        None, description="ID of the original meeting if this is a duplicate"
    )

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "meeting_id": "550e8400-e29b-41d4-a716-446655440000",
                    "status": "ongoing",
                    "meeting_url": "https://zoom.us/j/123456789",
                    "platform": "zoom",
                    "created_at": "2023-12-01T10:00:00Z",
                    "bot_join_time": "2023-12-01T10:05:00Z",
                    "bot_leave_time": None,
                    "participant_count": 5,
                    "transcript_entries": 42,
                    "video_link": None,
                    "org_id": "550e8400-e29b-41d4-a716-446655440000",
                }
            ]
        }
    )


class ParticipantInfo(BaseModel):
    """Model for participant information"""

    id: str = Field(..., description="Participant identifier")
    name: str = Field(..., description="Participant name")
    email: Optional[str] = Field(None, description="Participant email")
    joined_at: datetime = Field(..., description="When participant joined")
    left_at: Optional[datetime] = Field(None, description="When participant left")
    is_present: bool = Field(
        True, description="Whether participant is currently present"
    )


class TranscriptEntry(BaseModel):
    """Model for transcript entry"""

    timestamp: datetime = Field(..., description="Timestamp of the utterance")
    speaker: str = Field(..., description="Speaker name or identifier")
    content: str = Field(..., description="Transcript content")
    confidence: Optional[float] = Field(
        None, description="Transcription confidence score"
    )


class FormattedTranscript(BaseModel):
    """Model for formatted transcript data"""

    entries: List[TranscriptEntry] = Field([], description="List of transcript entries")
    summary: Optional[str] = Field(None, description="Meeting summary")
    key_points: Optional[List[str]] = Field(None, description="Key discussion points")
    action_items: Optional[List[str]] = Field(
        None, description="Action items identified"
    )


class MeetingTranscriptResponse(BaseModel):
    """Response model for meeting transcript"""

    meeting_id: str = Field(..., description="Unique meeting identifier")
    status: MeetingStatus = Field(..., description="Current meeting status")
    transcript: FormattedTranscript = Field(
        ..., description="Formatted transcript data"
    )
    participants: Optional[List[ParticipantInfo]] = Field(
        None, description="Meeting participants"
    )
    last_updated: datetime = Field(..., description="Last transcript update timestamp")
    last_segment_at: Optional[datetime] = Field(
        None,
        description=(
            "Wall-clock timestamp of the most recent transcript segment. "
            "Pass this value back as `since` on the next poll to fetch only "
            "new segments."
        ),
    )
    total_duration: Optional[int] = Field(
        None, description="Total meeting duration in seconds"
    )

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "meeting_id": "550e8400-e29b-41d4-a716-446655440000",
                    "status": "completed",
                    "transcript": {
                        "entries": [
                            {
                                "timestamp": "2023-12-01T10:05:30Z",
                                "speaker": "John Doe",
                                "content": "Welcome everyone to today's meeting.",
                                "confidence": 0.95,
                            }
                        ],
                        "summary": "Team standup meeting discussing project progress",
                        "key_points": [
                            "Project milestone achieved",
                            "Next sprint planning",
                        ],
                        "action_items": ["Update documentation", "Schedule follow-up"],
                    },
                    "participants": [
                        {
                            "id": "participant-1",
                            "name": "John Doe",
                            "email": "john@example.com",
                            "joined_at": "2023-12-01T10:05:00Z",
                            "left_at": "2023-12-01T10:30:00Z",
                            "is_present": False,
                        }
                    ],
                    "last_updated": "2023-12-01T10:30:00Z",
                    "total_duration": 1500,
                }
            ]
        }
    )


class MeetingListItem(BaseModel):
    """Slim per-meeting row for the dashboard list view."""

    meeting_id: str = Field(..., description="Unique meeting identifier")
    status: MeetingStatus = Field(..., description="Current meeting status")
    meeting_url: str = Field(..., description="Original meeting URL")
    platform: Optional[str] = Field(None, description="Meeting platform")
    bot_name: Optional[str] = Field(None, description="Bot display name used in the meeting")
    org_id: Optional[str] = Field(None, description="Organization ID")
    created_at: datetime = Field(..., description="Meeting creation timestamp")
    bot_join_time: Optional[datetime] = Field(None)
    bot_leave_time: Optional[datetime] = Field(None)
    duration_seconds: Optional[int] = Field(
        None, description="Bot-attached duration; null while ongoing"
    )
    participant_count: int = Field(0)
    transcript_entries: int = Field(0)
    video_link: Optional[str] = Field(None)


class MeetingListResponse(BaseModel):
    """Paginated meeting list response."""

    meetings: List[MeetingListItem] = Field(default_factory=list)
    next_cursor: Optional[str] = Field(
        None,
        description="Opaque cursor; pass back as `cursor` to fetch the next page.",
    )
    total: Optional[int] = Field(
        None, description="Best-effort total count when cheap to compute"
    )


class HealthResponse(BaseModel):
    """Health check response model"""

    status: str = Field(..., description="Service health status")
    service: str = Field(..., description="Service name")
    timestamp: datetime = Field(..., description="Health check timestamp")
    version: str = Field(..., description="Service version")


class ErrorResponse(BaseModel):
    """Error response model"""

    error: str = Field(..., description="Error message")
    detail: Optional[str] = Field(None, description="Detailed error information")
    timestamp: datetime = Field(
        default_factory=datetime.utcnow, description="Error timestamp"
    )


# Database Models (for internal use)
class MeetingRecord(BaseModel):
    """Internal model representing a meeting record"""

    id: str
    meeting_url: str
    normalized_meeting_url: Optional[str] = None
    status: MeetingStatus
    platform: Optional[str] = Field(
        None, description="Meeting platform (zoom, msteams, etc.)"
    )
    video_link: Optional[str] = None
    transcript: Optional[Dict[str, Any]] = None
    participants: Optional[List[Dict[str, Any]]] = None
    org_id: Optional[str] = None
    meeting_id: Optional[str] = None
    bot_join_time: Optional[datetime] = None
    bot_leave_time: Optional[datetime] = None
    bot_name: Optional[str] = None
    is_duplicate: bool = False
    original_meeting_id: Optional[str] = None
    transcript_source: Optional[TranscriptSource] = None
    # The claimed warm-pool pod hosting this meeting's bot. REQUIRED by the
    # Stop endpoint (DELETE /meetings) to abort the bot via the sidecar — if
    # it's missing, Stop silently falls back to a no-op legacy path and the
    # bot never leaves the call.
    pod_name: Optional[str] = None
    cluster_name: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


