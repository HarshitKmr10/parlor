"""Pydantic v2 request/response models for the /api/v1 product layer.

JSON is camelCase per API-CONTRACT.md. Models use ``populate_by_name`` so they
accept either the field name or its camelCase alias on input and emit the alias
on output (``model_dump(by_alias=True)`` / FastAPI ``response_model``).
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated, Any, List, Literal, Optional

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    ValidationInfo,
    field_validator,
    model_validator,
)
from pydantic.alias_generators import to_camel


def _normalize_email(value: str) -> str:
    """Canonicalize an email for use as an account identifier.

    EmailStr validates but does not lowercase, so ``Jane@x.com`` and
    ``jane@x.com`` would be stored as distinct strings. Lookups already compare
    case-insensitively (``LOWER(email)``); normalizing here keeps the *stored*
    value canonical too and matches the SSO path (which lowercases), closing a
    concurrent case-variant duplicate-signup race.
    """
    return value.strip().lower()


# EmailStr for identity fields (signup/login/invite): validated, then lowercased.
NormalizedEmail = Annotated[EmailStr, AfterValidator(_normalize_email)]


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )

    @model_validator(mode="before")
    @classmethod
    def _stringify_uuids(cls, data: Any) -> Any:
        # asyncpg returns UUID columns as uuid.UUID; our id/*_id fields are
        # typed str. Coerce on the way in so every model accepts raw DB rows.
        if isinstance(data, dict):
            return {
                k: (str(v) if isinstance(v, uuid.UUID) else v) for k, v in data.items()
            }
        return data


# ── Auth requests ──────────────────────────────────────────────────────────
class SignupRequest(CamelModel):
    email: NormalizedEmail
    password: str = Field(..., min_length=8, max_length=200, description="Plaintext password; hashed before storage.")
    name: str = Field(..., min_length=1, max_length=200, description="Display name for the new user.")
    workspace_name: str = Field(..., min_length=1, max_length=200, description="Name of the workspace created for this user, who becomes its owner.")


class LoginRequest(CamelModel):
    email: NormalizedEmail
    password: str = Field(..., min_length=1, max_length=200, description="Plaintext password, verified against the stored hash.")


class RefreshRequest(CamelModel):
    refresh_token: str = Field(..., min_length=1, description="A previously-issued refresh token to redeem for a new access/refresh pair (or revoke, on logout).")


class ForgotPasswordRequest(CamelModel):
    email: NormalizedEmail


class ResetPasswordRequest(CamelModel):
    token: str = Field(..., min_length=1, description="The reset token from the emailed link.")
    new_password: str = Field(..., min_length=8, max_length=200, description="New plaintext password; hashed before storage.")


# ── Entities ─────────────────────────────────────────────────────────────
class User(CamelModel):
    id: str
    email: str
    name: str
    created_at: datetime


class Workspace(CamelModel):
    id: str
    name: str
    slug: str
    role: Optional[str] = None


# ── Auth responses ─────────────────────────────────────────────────────────
class SignupResponse(CamelModel):
    user: User
    workspace: Workspace
    access_token: str
    refresh_token: str


class LoginResponse(CamelModel):
    user: User
    access_token: str
    refresh_token: str


class TokenPairResponse(CamelModel):
    access_token: str
    refresh_token: str


class MeResponse(CamelModel):
    user: User
    workspaces: List[Workspace]
    current_workspace: Optional[Workspace] = None


# ── API keys ───────────────────────────────────────────────────────────────
class ApiKeyCreateRequest(CamelModel):
    name: str = Field(..., min_length=1, max_length=200, description="A human-readable label for this key (e.g. 'CI pipeline').")


class ApiKey(CamelModel):
    id: str
    workspace_id: str
    name: str
    prefix: str = Field(..., description="Short non-secret prefix of the key, shown in the UI to help identify it.")
    created_at: datetime
    last_used_at: Optional[datetime] = None


class ApiKeyCreated(ApiKey):
    # The full key is returned exactly once, on create.
    key: str


# ── Workspace invites ────────────────────────────────────────────────────
InviteStatus = Literal["pending", "accepted", "expired", "revoked"]
InviteRole = Literal["admin", "member"]


class WorkspaceInviteCreateRequest(CamelModel):
    email: NormalizedEmail
    role: InviteRole = Field("member", description="Role the invitee will hold once they accept.")


class WorkspaceInvite(CamelModel):
    id: str
    workspace_id: str
    email: str
    role: str
    status: InviteStatus
    invited_by_user_id: str
    expires_at: datetime
    created_at: datetime


class WorkspaceInviteCreated(WorkspaceInvite):
    # The full accept link is returned exactly once, on create, so the caller
    # can send it (email delivery is best-effort/logged in dev).
    accept_url: Optional[str] = None


class WorkspaceInviteListResponse(CamelModel):
    items: List[WorkspaceInvite] = Field(default_factory=list)
    total: int = 0


class InvitePreview(CamelModel):
    """Public, unauthenticated view of a pending invite (accept page)."""

    workspace_name: str
    email: str
    role: str
    requires_signup: bool


class InviteAcceptRequest(CamelModel):
    # Only required when the invited email has no existing account yet.
    name: Optional[str] = Field(None, min_length=1, max_length=200, description="Display name for a new account; required only if the invited email has no account yet.")
    password: Optional[str] = Field(None, min_length=8, max_length=200, description="Password for a new account; required only if the invited email has no account yet.")


class InviteAcceptResponse(CamelModel):
    user: User
    workspace: Workspace
    access_token: str
    refresh_token: str


# ── Meetings ─────────────────────────────────────────────────────────────
Platform = Literal["zoom", "meet", "teams", "desktop"]
MeetingStatusLiteral = Literal["scheduled", "joining", "ongoing", "completed", "failed"]


class Participant(CamelModel):
    id: str
    name: str
    email: Optional[str] = None
    joined_at: Optional[datetime] = None
    left_at: Optional[datetime] = None


class TranscriptSegment(CamelModel):
    id: str
    speaker_id: Optional[str] = Field(None, description="Diarized speaker label (e.g. a raw 'Speaker 1' alias); resolved to a name via speaker profiles where possible.")
    speaker_name: str
    text: str
    t_start_sec: float = Field(..., description="Segment start, in seconds from meeting start.")
    t_end_sec: float = Field(..., description="Segment end, in seconds from meeting start.")
    created_at: Optional[datetime] = Field(None, description="When this segment was captured; drives the monotonic `since` cursor for polling and the live WebSocket.")


class ActionItem(CamelModel):
    id: str
    text: str
    assignee: Optional[str] = None
    due_date: Optional[str] = None
    done: bool = False


class Chapter(CamelModel):
    id: str
    title: str
    # LLMs frequently null the final chapter's end (runs to end-of-meeting) and
    # occasionally omit a start. Tolerate it instead of 500-ing the whole summary.
    t_start_sec: Optional[float] = Field(None, description="Chapter start in seconds; may be null if the AI omitted it.")
    t_end_sec: Optional[float] = Field(None, description="Chapter end in seconds; null for the final chapter running to end-of-meeting.")


class MeetingInsights(CamelModel):
    summary: str = ""
    key_points: List[str] = Field(default_factory=list)
    action_items: List[ActionItem] = Field(default_factory=list)
    chapters: List[Chapter] = Field(default_factory=list)


class SpeakerStat(CamelModel):
    """Per-speaker conversation metrics, mirroring Read.ai / Fathom analytics."""

    speaker_name: str
    talk_time_sec: float = 0.0
    talk_ratio: float = Field(0.0, description="Share of total speaking time this speaker held, 0..1.")
    word_count: int = 0
    words_per_minute: float = 0.0
    turns: int = Field(0, description="Number of distinct speaking turns.")
    longest_monologue_sec: float = 0.0
    questions_asked: int = 0
    filler_word_count: int = 0
    sentiment: str = Field("neutral", description="One of positive | neutral | negative.")
    sentiment_score: float = Field(0.0, description="Sentiment score in the range -1..1.")


class MeetingAnalytics(CamelModel):
    """Conversation analytics computed from the diarized transcript.

    All values are derived deterministically from transcript segments — no LLM
    call — so this endpoint works even when the AI service is unavailable.
    """

    meeting_id: str
    duration_sec: float = 0.0
    total_words: int = 0
    words_per_minute: float = 0.0
    num_speakers: int = 0
    num_turns: int = 0
    turns_per_minute: float = Field(0.0, description="Interactivity signal: higher means more back-and-forth exchange.")
    interactivity_score: float = Field(0.0, description="Normalized turn density, 0..100.")
    balance_score: float = Field(0.0, description="0..100; 100 = perfectly even talk-time across speakers.")
    longest_monologue_sec: float = 0.0
    longest_monologue_speaker: Optional[str] = None
    question_count: int = 0
    filler_word_count: int = 0
    overall_sentiment: str = "neutral"
    overall_sentiment_score: float = 0.0
    speakers: List[SpeakerStat] = Field(default_factory=list)
    computed_at: datetime


class Highlight(CamelModel):
    """A timestamped clip/bookmark a user marks on a meeting."""

    id: str
    meeting_id: str
    workspace_id: Optional[str] = None
    created_by: Optional[str] = None
    t_start_sec: float
    t_end_sec: float
    label: Optional[str] = None
    note: Optional[str] = None
    color: Optional[str] = None
    excerpt: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None


class HighlightCreate(CamelModel):
    t_start_sec: float = Field(..., ge=0, description="Clip start, in seconds from meeting start.")
    t_end_sec: float = Field(..., ge=0, description="Clip end, in seconds from meeting start; must be >= tStartSec.")
    label: Optional[str] = Field(None, max_length=300, description="Short title for the clip.")
    note: Optional[str] = Field(None, max_length=2000, description="Free-text note attached to the clip.")
    color: Optional[str] = Field(None, max_length=20, description="Display color for the clip (UI-defined values, e.g. a hex code or named color).")

    @model_validator(mode="after")
    def _check_range(self) -> "HighlightCreate":
        if self.t_end_sec < self.t_start_sec:
            raise ValueError("tEndSec must be >= tStartSec")
        return self


class HighlightUpdate(CamelModel):
    t_start_sec: Optional[float] = Field(None, ge=0, description="New clip start, in seconds from meeting start.")
    t_end_sec: Optional[float] = Field(None, ge=0, description="New clip end, in seconds from meeting start.")
    label: Optional[str] = Field(None, max_length=300, description="Short title for the clip.")
    note: Optional[str] = Field(None, max_length=2000, description="Free-text note attached to the clip.")
    color: Optional[str] = Field(None, max_length=20, description="Display color for the clip.")


class HighlightListResponse(CamelModel):
    items: List[Highlight] = Field(default_factory=list)
    total: int = 0


class WorkspaceHighlight(Highlight):
    """A highlight enriched with its meeting's title for the reel view."""

    meeting_title: Optional[str] = None


class WorkspaceHighlightListResponse(CamelModel):
    items: List[WorkspaceHighlight] = Field(default_factory=list)
    total: int = 0
    limit: int = 0
    offset: int = 0


class SearchSnippet(CamelModel):
    """A matching transcript moment, with the query marked via <mark> tags."""

    segment_id: str = ""
    speaker_name: str = "Unknown"
    t_start_sec: float = 0.0
    snippet: str = ""


class SearchResultItem(CamelModel):
    meeting_id: str
    title: Optional[str] = None
    score: int = Field(0, description="Relevance score, higher is a better match; results are sorted by this descending.")
    matched_segments: int = Field(0, description="Number of transcript segments that matched the query.")
    title_match: bool = Field(False, description="Whether the query matched the meeting title.")
    summary_match: bool = Field(False, description="Whether the query matched the AI-generated summary.")
    snippets: List[SearchSnippet] = Field(default_factory=list)


class SearchResponse(CamelModel):
    query: str
    items: List[SearchResultItem] = Field(default_factory=list)
    total: int = 0


class DigestMeeting(CamelModel):
    id: str
    title: Optional[str] = None
    status: Optional[str] = None
    duration_sec: Optional[float] = None
    created_at: Optional[datetime] = None


class DigestAssignee(CamelModel):
    assignee: str
    open: int = 0
    done: int = 0


class DigestActionItems(CamelModel):
    total: int = 0
    open: int = 0
    done: int = 0
    by_assignee: List[DigestAssignee] = Field(default_factory=list)


class DigestReport(CamelModel):
    """A workspace activity rollup over a time window."""

    period_from: datetime
    period_to: datetime
    meeting_count: int = 0
    completed_count: int = 0
    total_duration_sec: float = 0.0
    avg_duration_sec: float = 0.0
    busiest_day: Optional[str] = None
    action_items: DigestActionItems = Field(default_factory=DigestActionItems)
    meetings: List[DigestMeeting] = Field(default_factory=list)
    generated_at: datetime


class ActionItemRecord(CamelModel):
    """A trackable action item promoted out of insights into its own row."""

    id: str
    meeting_id: str
    text: str
    assignee: Optional[str] = None
    due_date: Optional[str] = None
    done: bool = False
    source: str = Field("manual", description="Either 'ai' (extracted from the summary) or 'manual' (added by a user).")
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class ActionItemCreate(CamelModel):
    text: str = Field(..., min_length=1, max_length=2000, description="The task description.")
    assignee: Optional[str] = Field(None, max_length=200, description="Free-text assignee name; not validated against workspace membership.")
    due_date: Optional[str] = Field(None, max_length=64, description="Free-text due date (not strictly parsed/validated).")


class ActionItemUpdate(CamelModel):
    text: Optional[str] = Field(None, min_length=1, max_length=2000)
    assignee: Optional[str] = Field(None, max_length=200)
    due_date: Optional[str] = Field(None, max_length=64)
    done: Optional[bool] = Field(None, description="Marks the item complete/incomplete.")


class ActionItemListResponse(CamelModel):
    items: List[ActionItemRecord] = Field(default_factory=list)
    total: int = 0


class SummaryTemplateCreate(CamelModel):
    name: str = Field(..., min_length=1, max_length=120, description="Must be unique within the workspace; 409 duplicate_name otherwise.")
    instructions: str = Field("", max_length=4000, description="Free-text instructions steering how the AI summarizes meetings using this template.")
    sections: List[str] = Field(default_factory=list, description="Named sections the summary should be broken into.")
    is_default: bool = Field(False, description="Whether new summarizations should use this template when none is explicitly requested.")
    from_preset: Optional[str] = Field(None, description="Key of a built-in preset (see GET /summary-templates/presets) to seed name/instructions/sections from; explicit fields here override the preset.")


class SummaryTemplateUpdate(CamelModel):
    name: Optional[str] = Field(None, min_length=1, max_length=120)
    instructions: Optional[str] = Field(None, max_length=4000)
    sections: Optional[List[str]] = None
    is_default: Optional[bool] = None


class SummaryTemplate(CamelModel):
    id: str
    name: str
    instructions: str = ""
    sections: List[str] = Field(default_factory=list)
    is_default: bool = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class SummaryTemplatePreset(CamelModel):
    key: str
    name: str
    instructions: str
    sections: List[str] = Field(default_factory=list)


class WebhookEndpointCreate(CamelModel):
    url: str = Field(..., min_length=1, max_length=2000, description="Must be https:// and pass the SSRF guard (no localhost/private/loopback/link-local hosts).")
    description: Optional[str] = Field(None, max_length=500, description="Human-readable label for this endpoint.")
    event_types: List[str] = Field(default_factory=list, description="Event types to subscribe to; empty (the default) subscribes to every event.")


class WebhookEndpointUpdate(CamelModel):
    url: Optional[str] = Field(None, min_length=1, max_length=2000)
    description: Optional[str] = Field(None, max_length=500)
    event_types: Optional[List[str]] = None
    enabled: Optional[bool] = None


class WebhookEndpoint(CamelModel):
    id: str
    url: str
    description: Optional[str] = None
    event_types: List[str] = Field(default_factory=list)
    secret: str = Field(..., description="HMAC signing secret for verifying delivery payloads; shown once here and thereafter never returned.")
    enabled: bool = True
    consecutive_failures: int = Field(0, description="Consecutive terminal delivery failures; the endpoint auto-disables at 15.")
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class WebhookDelivery(CamelModel):
    id: str
    endpoint_id: str
    event_id: str
    event_type: str
    status: str = Field(..., description="One of pending | delivered | failed.")
    attempts: int = 0
    max_attempts: int = Field(6, description="Delivery is marked failed for good once this many attempts are exhausted.")
    response_status: Optional[int] = Field(None, description="HTTP status code returned by the receiver on the most recent attempt, if any.")
    error: Optional[str] = None
    next_attempt_at: Optional[datetime] = Field(None, description="When the next retry is scheduled, following the exponential backoff schedule.")
    delivered_at: Optional[datetime] = None
    created_at: Optional[datetime] = None


class WebhookDeliveryListResponse(CamelModel):
    items: List[WebhookDelivery] = Field(default_factory=list)
    total: int = 0


class WebhookEventCatalog(CamelModel):
    event_types: List[str] = Field(default_factory=list)


class CommentAuthor(CamelModel):
    id: Optional[str] = None
    name: str = "Unknown"


class CommentCreate(CamelModel):
    body: str = Field(..., min_length=1, max_length=5000, description="Comment text.")
    anchor_t_sec: Optional[float] = Field(None, ge=0, description="Optional transcript timestamp (seconds) this comment is anchored to.")
    anchor_segment_id: Optional[str] = Field(None, max_length=200, description="Optional transcript segment id this comment is anchored to.")
    parent_id: Optional[str] = Field(None, description="Parent comment id to reply in a thread; must belong to the same meeting.")
    mentions: List[str] = Field(default_factory=list, description="User IDs to @mention; filtered against workspace membership server-side.")


class CommentUpdate(CamelModel):
    body: Optional[str] = Field(None, min_length=1, max_length=5000, description="New comment text (author-only edit).")
    mentions: Optional[List[str]] = Field(None, description="Replacement list of mentioned user IDs (author-only edit).")
    resolved: Optional[bool] = Field(None, description="Toggles the resolved flag; any workspace member may set this.")


class Comment(CamelModel):
    id: str
    meeting_id: str
    parent_id: Optional[str] = None
    author: CommentAuthor
    body: str
    anchor_t_sec: Optional[float] = None
    anchor_segment_id: Optional[str] = None
    mentions: List[CommentAuthor] = Field(default_factory=list)
    resolved: bool = False
    edited: bool = False
    created_at: datetime
    updated_at: Optional[datetime] = None


class CommentListResponse(CamelModel):
    items: List[Comment] = Field(default_factory=list)
    total: int = 0


class ShareCreateRequest(CamelModel):
    """Create/rotate a public share link for a meeting."""

    include_transcript: bool = Field(False, description="Whether the public view includes the full transcript.")
    include_highlights: bool = Field(True, description="Whether the public view includes highlight clips.")
    include_analytics: bool = Field(False, description="Whether the public view includes conversation analytics.")
    expires_in_days: Optional[int] = Field(None, ge=1, le=365, description="If set, the link stops working this many days from now; omit for no expiry.")


class ShareLink(CamelModel):
    """Owner-facing view of a meeting's share link."""

    meeting_id: str
    token: str
    path: str = Field(..., description="Relative app path, e.g. /share/{token}.")
    url: Optional[str] = Field(None, description="Absolute URL; only populated when a public base URL is configured on the server.")
    include_transcript: bool = False
    include_highlights: bool = True
    include_analytics: bool = False
    revoked: bool = False
    expires_at: Optional[datetime] = None
    view_count: int = 0
    last_viewed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None


class PublicHighlight(CamelModel):
    """A highlight projected for public viewing — no workspace/owner IDs."""

    t_start_sec: float
    t_end_sec: float
    label: Optional[str] = None
    note: Optional[str] = None
    color: Optional[str] = None
    excerpt: Optional[str] = None


class PublicMeetingView(CamelModel):
    """Read-only recap returned to anyone holding a valid share token.

    Deliberately minimal — no workspace, owner, IDs or platform internals leak.
    Optional sections are populated only when the share's scope flags allow.
    """

    title: Optional[str] = None
    summary: str = ""
    key_points: List[str] = Field(default_factory=list)
    action_items: List[ActionItem] = Field(default_factory=list)
    chapters: List[Chapter] = Field(default_factory=list)
    duration_sec: Optional[int] = None
    transcript: Optional[List[TranscriptSegment]] = None
    highlights: Optional[List[PublicHighlight]] = None
    analytics: Optional[MeetingAnalytics] = None
    shared_at: datetime


class Meeting(CamelModel):
    id: str
    workspace_id: Optional[str] = None
    title: Optional[str] = None
    platform: Optional[Platform] = Field(None, description="'desktop' indicates a botless desktop-capture session (no bot dispatched).")
    meeting_url: str
    status: MeetingStatusLiteral
    scheduled_at: Optional[datetime] = Field(None, description="When set, bot dispatch is deferred until this time instead of happening immediately.")
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    duration_sec: Optional[int] = None
    participants: List[Participant] = Field(default_factory=list)
    has_summary: bool = False
    has_recording: bool = False
    created_at: datetime


class MeetingWithInsights(Meeting):
    insights: Optional[MeetingInsights] = None


class MeetingListResponse(CamelModel):
    items: List[Meeting]
    total: int
    limit: int
    offset: int


class MeetingCreateRequest(CamelModel):
    meeting_url: str = Field(..., min_length=1, description="A Zoom, Google Meet, or Microsoft Teams meeting URL; the platform is auto-detected from it.")
    title: Optional[str] = Field(None, max_length=500, description="Optional display title; falls back to a default if omitted.")
    scheduled_at: Optional[datetime] = Field(None, description="If set, the bot is dispatched at this future time instead of immediately.")
    bot_name: Optional[str] = Field(None, max_length=100, description="Custom display name for the bot in the meeting.")


class BotlessCreateRequest(CamelModel):
    """Create a botless (desktop-capture) meeting — no bot dispatch."""

    title: Optional[str] = Field(None, max_length=500, description="Optional display title.")
    source: Optional[Literal["desktop"]] = Field("desktop", description="Capture source; currently only 'desktop' (the desktop-capture client) is supported.")


class TranscriptIngestRequest(CamelModel):
    """Append externally-captured transcript segments to a meeting."""

    segments: List[TranscriptSegment] = Field(..., min_length=1, description="Segments to append, in any order; the server sorts by tStartSec and clamps timestamps to stay monotonic.")


class TranscriptIngestResponse(CamelModel):
    appended: int
    last_segment_at: Optional[datetime] = None


class TranscriptResponse(CamelModel):
    items: List[TranscriptSegment]
    last_segment_at: Optional[datetime] = None


class AskRequest(CamelModel):
    question: str = Field(..., min_length=1, max_length=8000, description="The question to ask over the meeting transcript(s).")
    history: Optional[List[dict[str, Any]]] = Field(None, description="Prior turns as `{role, content}` objects, for follow-up questions; only the most recent turns are used.")


class Citation(CamelModel):
    segment_id: str
    speaker_name: str
    text: str
    t_start_sec: float
    # Populated on workspace-wide ("Ask Parlor") answers so each citation can
    # link back to its source meeting.
    meeting_id: Optional[str] = None
    meeting_title: Optional[str] = None


class AskResponse(CamelModel):
    answer: str
    citations: List[Citation] = Field(default_factory=list)

    @field_validator("citations", mode="before")
    @classmethod
    def _default_citations(cls, v: Any) -> Any:
        return v or []


class Notification(CamelModel):
    id: str
    type: str
    title: str
    body: Optional[str] = None
    link: Optional[str] = None
    meeting_id: Optional[str] = None
    read: bool = False
    created_at: datetime


class NotificationListResponse(CamelModel):
    items: List[Notification] = Field(default_factory=list)
    unread: int = 0


class DigestPreferences(CamelModel):
    enabled: bool = False
    frequency: str = "weekly"        # daily | weekly
    hour_utc: int = 13
    day_of_week: int = 0             # 0=Mon..6=Sun
    channel: str = "email"           # email | slack
    target: Optional[str] = None
    last_sent_at: Optional[datetime] = None


class DigestPreferencesUpdate(CamelModel):
    enabled: bool = False
    frequency: str = Field("weekly", pattern="^(daily|weekly)$", description="How often to send the digest: daily or weekly.")
    hour_utc: int = Field(13, ge=0, le=23, description="Hour of day (UTC) to send the digest.")
    day_of_week: int = Field(0, ge=0, le=6, description="Day to send a weekly digest; 0=Monday..6=Sunday. Ignored for daily.")
    channel: str = Field("email", pattern="^(email|slack)$", description="Delivery channel: email or slack.")
    target: Optional[str] = Field(None, max_length=2000, description="Delivery target: an email address for the email channel, or a webhook URL (validated against the SSRF guard) for slack.")

    @field_validator("target")
    @classmethod
    def _validate_slack_target(
        cls, value: Optional[str], info: ValidationInfo
    ) -> Optional[str]:
        """The Slack digest target is a second webhook-URL sink alongside
        registered webhook endpoints — POST /digest-preferences/test and the
        background scheduler both send an HTTP request to it. It must go
        through the same SSRF guard, at write time, or a workspace member
        could park an internal/metadata URL here that never gets validated.
        Email targets are addresses, not URLs, so they're left alone."""
        if value is None or info.data.get("channel") != "slack":
            return value
        from ...webhooks.safety import InvalidWebhookUrl, validate_webhook_url

        try:
            return validate_webhook_url(value)
        except InvalidWebhookUrl as exc:
            raise ValueError(str(exc)) from exc


class MeetingAssist(CamelModel):
    summary_so_far: str = ""
    suggested_questions: List[str] = Field(default_factory=list)
    coverage_gaps: List[str] = Field(default_factory=list)
    segment_count: int = 0


class SpeakerProfile(CamelModel):
    id: str
    display_name: str
    email: Optional[str] = None
    aliases: List[str] = Field(default_factory=list)


class SpeakerProfileCreate(CamelModel):
    display_name: str = Field(..., min_length=1, max_length=200, description="The real name this profile resolves diarized aliases to.")
    email: Optional[str] = Field(None, max_length=320)
    aliases: List[str] = Field(default_factory=list, description="Diarized speaker labels (e.g. 'Speaker 1') that should resolve to this person.")


class SpeakerProfileUpdate(CamelModel):
    display_name: Optional[str] = Field(None, min_length=1, max_length=200)
    email: Optional[str] = Field(None, max_length=320)
    aliases: Optional[List[str]] = Field(None, description="Replacement list of diarized aliases mapped to this person.")


class CoachingSpeaker(CamelModel):
    speaker_name: str
    talk_ratio: float = 0.0
    questions_asked: int = 0
    words_per_minute: float = 0.0
    filler_word_count: int = 0


class CoachingScorecard(CamelModel):
    meeting_id: str
    overall_grade: str = "F"
    overall_score: float = 0.0
    talk_ratio_top: float = 0.0
    longest_monologue_sec: float = 0.0
    question_count: int = 0
    balance_score: float = 0.0
    tips: List[str] = Field(default_factory=list)
    per_speaker: List[CoachingSpeaker] = Field(default_factory=list)


class Tracker(CamelModel):
    id: str
    name: str
    keywords: List[str] = Field(default_factory=list)
    enabled: bool = True


class TrackerCreate(CamelModel):
    name: str = Field(..., min_length=1, max_length=200, description="Display name for the tracker.")
    keywords: List[str] = Field(default_factory=list, description="Keywords/phrases that flag a hit when mentioned in a summarized meeting.")


class TrackerUpdate(CamelModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    keywords: Optional[List[str]] = Field(None, description="Replacement list of keywords/phrases.")
    enabled: Optional[bool] = Field(None, description="Whether this tracker is actively scanned during summarization.")


class TrackerHit(CamelModel):
    id: str
    tracker_id: str
    meeting_id: str
    matched_keyword: str
    snippet: str
    segment_id: Optional[str] = None
    t_start_sec: float = 0.0
    created_at: datetime


class TrackerHitListResponse(CamelModel):
    items: List[TrackerHit] = Field(default_factory=list)
    total: int = 0


class NlpSettings(CamelModel):
    redaction_enabled: bool = False
    redact_emails: bool = True
    redact_phones: bool = True
    redact_cards: bool = True
    custom_vocab: List[str] = Field(default_factory=list)
    summary_language: str = "en"


class NlpSettingsUpdate(CamelModel):
    redaction_enabled: bool = Field(False, description="Master switch; when off, no redaction runs regardless of the per-type toggles below.")
    redact_emails: bool = True
    redact_phones: bool = True
    redact_cards: bool = True
    custom_vocab: List[str] = Field(default_factory=list, description="Domain-specific terms (product names, jargon) the summarizer should recognize.")
    summary_language: str = Field("en", max_length=10, description="ISO language code the AI summary should be generated in.")


class AuditEvent(CamelModel):
    id: str
    actor_id: Optional[str] = None
    action: str
    resource_type: str
    resource_id: Optional[str] = None
    metadata: dict = Field(default_factory=dict)
    created_at: datetime


class AuditEventListResponse(CamelModel):
    items: List[AuditEvent] = Field(default_factory=list)
    total: int = 0
    limit: int = 0
    offset: int = 0


class RetentionSettings(CamelModel):
    retention_days: Optional[int] = None
    legal_hold: bool = False


class RetentionSettingsUpdate(CamelModel):
    retention_days: Optional[int] = Field(None, ge=1, le=3650, description="Meetings older than this are soft-deleted by the retention sweeper; null disables automatic deletion.")
    legal_hold: bool = Field(False, description="When true, pauses both the soft-delete and hard-delete sweeper phases entirely.")


class UsageCreator(CamelModel):
    creator: str
    meetings: int = 0
    minutes: float = 0.0


class LlmUsageBreakdown(CamelModel):
    """Token/cost totals for one provider+model pair, observability-only."""

    provider: str
    model: str
    total_tokens: int = 0
    estimated_cost_usd: float = 0.0
    call_count: int = 0


class LlmUsageDailyPoint(CamelModel):
    date: str
    total_tokens: int = 0
    estimated_cost_usd: float = 0.0


class UsageSummary(CamelModel):
    meeting_count: int = 0
    completed_count: int = 0
    total_minutes: float = 0.0
    active_members: int = 0
    per_creator: List[UsageCreator] = Field(default_factory=list)
    # LLM token/cost observability (additive; this product has no billing —
    # never used to gate functionality). estimated_cost_usd is a rough
    # estimate, not billing-grade accounting (see ai-service pricing table).
    llm_total_tokens: int = 0
    llm_estimated_cost_usd: float = Field(0.0, description="Rough cost estimate, not billing-grade accounting; observability-only, never used to gate functionality.")
    llm_call_count: int = 0
    llm_breakdown: List[LlmUsageBreakdown] = Field(default_factory=list)
    llm_daily_trend: List[LlmUsageDailyPoint] = Field(default_factory=list)


# ── Calendar ─────────────────────────────────────────────────────────────
CalendarProvider = Literal["google", "microsoft"]


class CalendarAccount(CamelModel):
    id: str
    provider: CalendarProvider
    email: str
    auto_join: bool = False
    connected_at: datetime


class CalendarAccountUpdate(CamelModel):
    auto_join: bool = Field(..., description="When true, the poller auto-dispatches a bot for this account's upcoming calendar meetings.")


# ── Outbound integrations ──────────────────────────────────────────────────
IntegrationKind = Literal["slack", "email", "notion", "hubspot", "salesforce"]


class Integration(CamelModel):
    kind: IntegrationKind
    enabled: bool = False
    config: dict[str, Any] = Field(default_factory=dict, description="Provider-specific config (e.g. webhookUrl for slack, to for email); shape varies by kind.")
    implemented: bool = Field(True, description="Whether this kind has a real registered provider; always true today, reserved for a future placeholder kind.")


class IntegrationUpdate(CamelModel):
    kind: IntegrationKind
    enabled: bool = False
    config: dict[str, Any] = Field(default_factory=dict, description="Provider-specific config; shape varies by kind (see API-CONTRACT.md).")


# ── Google Workspace (org-wide capture) ────────────────────────────────────
WorkspaceAuthMode = Literal["dwd", "marketplace"]


class GoogleWorkspaceConfigRequest(CamelModel):
    """Configure org-wide capture for the active workspace (admin action).

    For ``dwd`` (default), ``serviceAccountJson`` + ``delegatedAdminEmail`` are
    required on first configure. The SA JSON is encrypted at rest and NEVER
    returned. On a later toggle (enable/disable) it may be omitted to keep the
    stored key.
    """

    auth_mode: WorkspaceAuthMode = Field("dwd", description="Domain-wide-delegation ('dwd', supported today) or 'marketplace' (fields reserved, not yet implemented).")
    service_account_json: Optional[str] = Field(None, min_length=1, description="Google service-account JSON key; required on first configure under dwd. Encrypted at rest, never returned.")
    delegated_admin_email: Optional[EmailStr] = Field(None, description="Admin email the service account impersonates for Directory + calendar reads; required for dwd.")
    domain: Optional[str] = Field(None, max_length=320, description="The Google Workspace domain to capture for.")
    customer_id: Optional[str] = Field(None, max_length=64, description="Google Workspace customer ID, used by the Directory API to list org users.")
    marketplace_client_id: Optional[str] = Field(None, max_length=255, description="Reserved for the future Marketplace auth mode.")
    marketplace_project_number: Optional[str] = Field(None, max_length=64, description="Reserved for the future Marketplace auth mode.")
    # The Workspace account the notetaker bot joins meetings AS (auto-admission
    # to internal Meet meetings). Optional; falls back to MEET_NOTETAKER_EMAIL.
    notetaker_email: Optional[EmailStr] = Field(None, description="The Workspace account the notetaker bot joins meetings as, for auto-admission to internal Meet meetings. Falls back to MEET_NOTETAKER_EMAIL if unset.")
    enabled: bool = True


class GoogleWorkspaceConfig(CamelModel):
    """Public view of org-wide config. The SA JSON is replaced by a fingerprint;
    the raw key material is never serialized."""

    workspace_id: str
    auth_mode: WorkspaceAuthMode
    domain: Optional[str] = None
    customer_id: Optional[str] = None
    delegated_admin_email: Optional[str] = None
    marketplace_client_id: Optional[str] = None
    marketplace_project_number: Optional[str] = None
    notetaker_email: Optional[str] = None
    has_service_account: bool = Field(False, description="Whether a service-account key is stored; the key material itself is never returned.")
    service_account_fingerprint: Optional[str] = Field(None, description="Non-secret fingerprint of the stored service-account key, for identification without exposing it.")
    enabled: bool = False
    created_at: datetime
    updated_at: datetime


class GoogleWorkspaceUsersResponse(CamelModel):
    """Preview of discovered org users — proves directory + DWD work."""

    users: List[str] = Field(default_factory=list)
    total: int = 0


# ── Pass 2: ad-hoc Meet capture — events subscriptions ──────────────────────
class EventSubscription(CamelModel):
    """One Workspace Events subscription (per org user)."""

    id: str
    workspace_id: str
    google_subscription_id: Optional[str] = None
    target_user_email: str
    event_types: List[str] = Field(default_factory=list)
    expire_time: Optional[datetime] = None
    state: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    @field_validator("event_types", mode="before")
    @classmethod
    def _coerce_event_types(cls, v: Any) -> Any:
        # event_types is stored as JSONB; asyncpg may hand it back as a str.
        if isinstance(v, str):
            try:
                import json as _json

                parsed = _json.loads(v)
                return parsed if isinstance(parsed, list) else []
            except (ValueError, TypeError):
                return []
        return v or []


class EventSubscriptionsResponse(CamelModel):
    subscriptions: List[EventSubscription] = Field(default_factory=list)
    total: int = 0


class EventSubscribeResponse(CamelModel):
    created: int = 0
    failed: int = 0
    total: int = 0


# ── Pass 2: org meeting policy ──────────────────────────────────────────────
PolicyMode = Literal["all", "allowlist", "denylist"]


class PolicyRules(CamelModel):
    emails: List[str] = Field(default_factory=list, description="Specific email addresses this rule applies to.")
    domains: List[str] = Field(default_factory=list, description="Email domains this rule applies to.")
    ous: List[str] = Field(default_factory=list, description="Google Workspace organizational units this rule applies to.")


class OrgMeetingPolicyModel(CamelModel):
    """Per-workspace auto-join policy consulted before EVERY dispatch."""

    auto_join_enabled: bool = Field(True, description="Master switch for org-wide auto-join.")
    mode: PolicyMode = Field("all", description="'all' auto-joins every eligible meeting; 'allowlist'/'denylist' consult the allow/deny rules below.")
    allow: PolicyRules = Field(default_factory=PolicyRules, description="Rules defining who is allowed when mode is 'allowlist'.")
    deny: PolicyRules = Field(default_factory=PolicyRules, description="Rules defining who is excluded when mode is 'denylist'.")
    opt_out_emails: List[str] = Field(default_factory=list, description="Individual emails excluded from auto-join regardless of mode.")
    recording_disclosure_text: Optional[str] = Field(None, description="Disclosure text the bot announces or displays to participants when it joins.")
