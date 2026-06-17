"""Pydantic v2 request/response models for the /api/v1 product layer.

JSON is camelCase per API-CONTRACT.md. Models use ``populate_by_name`` so they
accept either the field name or its camelCase alias on input and emit the alias
on output (``model_dump(by_alias=True)`` / FastAPI ``response_model``).
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, List, Literal, Optional

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
    model_validator,
)
from pydantic.alias_generators import to_camel


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
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=200)
    name: str = Field(..., min_length=1, max_length=200)
    workspace_name: str = Field(..., min_length=1, max_length=200)


class LoginRequest(CamelModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=200)


class RefreshRequest(CamelModel):
    refresh_token: str = Field(..., min_length=1)


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
    name: str = Field(..., min_length=1, max_length=200)


class ApiKey(CamelModel):
    id: str
    workspace_id: str
    name: str
    prefix: str
    created_at: datetime
    last_used_at: Optional[datetime] = None


class ApiKeyCreated(ApiKey):
    # The full key is returned exactly once, on create.
    key: str


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
    speaker_id: Optional[str] = None
    speaker_name: str
    text: str
    t_start_sec: float
    t_end_sec: float
    created_at: Optional[datetime] = None


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
    t_start_sec: Optional[float] = None
    t_end_sec: Optional[float] = None


class MeetingInsights(CamelModel):
    summary: str = ""
    key_points: List[str] = Field(default_factory=list)
    action_items: List[ActionItem] = Field(default_factory=list)
    chapters: List[Chapter] = Field(default_factory=list)


class Meeting(CamelModel):
    id: str
    workspace_id: Optional[str] = None
    title: Optional[str] = None
    platform: Optional[Platform] = None
    meeting_url: str
    status: MeetingStatusLiteral
    scheduled_at: Optional[datetime] = None
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
    meeting_url: str = Field(..., min_length=1)
    title: Optional[str] = Field(None, max_length=500)
    scheduled_at: Optional[datetime] = None
    bot_name: Optional[str] = Field(None, max_length=100)


class BotlessCreateRequest(CamelModel):
    """Create a botless (desktop-capture) meeting — no bot dispatch."""

    title: Optional[str] = Field(None, max_length=500)
    source: Optional[Literal["desktop"]] = "desktop"


class TranscriptIngestRequest(CamelModel):
    """Append externally-captured transcript segments to a meeting."""

    segments: List[TranscriptSegment] = Field(..., min_length=1)


class TranscriptIngestResponse(CamelModel):
    appended: int
    last_segment_at: Optional[datetime] = None


class TranscriptResponse(CamelModel):
    items: List[TranscriptSegment]
    last_segment_at: Optional[datetime] = None


class AskRequest(CamelModel):
    question: str = Field(..., min_length=1)
    history: Optional[List[dict[str, Any]]] = None


class Citation(CamelModel):
    segment_id: str
    speaker_name: str
    text: str
    t_start_sec: float


class AskResponse(CamelModel):
    answer: str
    citations: List[Citation] = Field(default_factory=list)

    @field_validator("citations", mode="before")
    @classmethod
    def _default_citations(cls, v: Any) -> Any:
        return v or []


# ── Calendar ─────────────────────────────────────────────────────────────
CalendarProvider = Literal["google", "microsoft"]


class CalendarAccount(CamelModel):
    id: str
    provider: CalendarProvider
    email: str
    auto_join: bool = False
    connected_at: datetime


class CalendarAccountUpdate(CamelModel):
    auto_join: bool


# ── Outbound integrations ──────────────────────────────────────────────────
IntegrationKind = Literal["slack", "email", "notion", "hubspot"]


class Integration(CamelModel):
    kind: IntegrationKind
    enabled: bool = False
    config: dict[str, Any] = Field(default_factory=dict)
    implemented: bool = True


class IntegrationUpdate(CamelModel):
    kind: IntegrationKind
    enabled: bool = False
    config: dict[str, Any] = Field(default_factory=dict)


# ── Google Workspace (org-wide capture) ────────────────────────────────────
WorkspaceAuthMode = Literal["dwd", "marketplace"]


class GoogleWorkspaceConfigRequest(CamelModel):
    """Configure org-wide capture for the active workspace (admin action).

    For ``dwd`` (default), ``serviceAccountJson`` + ``delegatedAdminEmail`` are
    required on first configure. The SA JSON is encrypted at rest and NEVER
    returned. On a later toggle (enable/disable) it may be omitted to keep the
    stored key.
    """

    auth_mode: WorkspaceAuthMode = "dwd"
    service_account_json: Optional[str] = Field(None, min_length=1)
    delegated_admin_email: Optional[EmailStr] = None
    domain: Optional[str] = Field(None, max_length=320)
    customer_id: Optional[str] = Field(None, max_length=64)
    marketplace_client_id: Optional[str] = Field(None, max_length=255)
    marketplace_project_number: Optional[str] = Field(None, max_length=64)
    # The Workspace account the notetaker bot joins meetings AS (auto-admission
    # to internal Meet meetings). Optional; falls back to MEET_NOTETAKER_EMAIL.
    notetaker_email: Optional[EmailStr] = None
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
    has_service_account: bool = False
    service_account_fingerprint: Optional[str] = None
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
    emails: List[str] = Field(default_factory=list)
    domains: List[str] = Field(default_factory=list)
    ous: List[str] = Field(default_factory=list)


class OrgMeetingPolicyModel(CamelModel):
    """Per-workspace auto-join policy consulted before EVERY dispatch."""

    auto_join_enabled: bool = True
    mode: PolicyMode = "all"
    allow: PolicyRules = Field(default_factory=PolicyRules)
    deny: PolicyRules = Field(default_factory=PolicyRules)
    opt_out_emails: List[str] = Field(default_factory=list)
    recording_disclosure_text: Optional[str] = None
