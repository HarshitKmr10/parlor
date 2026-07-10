"""Pydantic v2 schemas matching docs/API-CONTRACT.md.

JSON is camelCase on the wire (via aliases); Python attributes stay snake_case.
All models populate by both field name and alias so internal construction and
HTTP request parsing both work.
"""

from __future__ import annotations

import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from .providers.base import TokenUsage
from .providers.pricing import estimate_cost_usd


class CamelModel(BaseModel):
    """Base model: camelCase JSON aliases, accept by name or alias."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="ignore",
    )


# --- Shared entities (mirror the API contract) -----------------------------


class TranscriptSegment(CamelModel):
    id: str
    speaker_id: str | None = None
    speaker_name: str
    # 100k chars comfortably covers a single legitimately-oversized segment
    # (summarize.py's map-reduce chunker already splits any segment larger
    # than MAX_CHARS_PER_CHUNK=48_000 into sub-segments) while still bounding
    # a single request's payload size.
    text: str = Field(max_length=100_000)
    t_start_sec: float
    t_end_sec: float | None = None
    created_at: str | None = None


class ActionItem(CamelModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    text: str
    assignee: str | None = None
    due_date: str | None = None
    done: bool = False


class Chapter(CamelModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    t_start_sec: float
    t_end_sec: float | None = None


class TokenUsageOut(CamelModel):
    """Additive, observability-only usage/cost readout for an LLM call.

    Never used to gate functionality -- this exists purely so the product
    can show a user their own usage. ``estimated_cost_usd`` is a rough
    estimate (see ``app/providers/pricing.py``), not billing-grade
    accounting, and is ``None`` for models not in the price table.
    """

    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    provider: str
    model: str
    estimated_cost_usd: float | None = None


def token_usage_to_schema(usage: TokenUsage) -> TokenUsageOut:
    return TokenUsageOut(
        prompt_tokens=usage.prompt_tokens,
        completion_tokens=usage.completion_tokens,
        total_tokens=usage.total_tokens,
        provider=usage.provider,
        model=usage.model,
        estimated_cost_usd=estimate_cost_usd(usage),
    )


class MeetingInsights(CamelModel):
    summary: str
    key_points: list[str] = Field(default_factory=list)
    action_items: list[ActionItem] = Field(default_factory=list)
    chapters: list[Chapter] = Field(default_factory=list)
    usage: TokenUsageOut | None = None


class Citation(CamelModel):
    segment_id: str
    speaker_name: str
    text: str
    t_start_sec: float
    # Present on workspace-wide ("ask across all meetings") answers so the
    # caller can attribute each citation to its source meeting.
    meeting_id: str | None = None


class ChatMessage(CamelModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=8000)


class MeetingMeta(CamelModel):
    title: str
    participants: list[str] = Field(default_factory=list)
    # Optional summarization controls threaded from the product layer.
    target_language: str | None = None
    custom_vocabulary: list[str] = Field(default_factory=list)


# --- Request / response payloads -------------------------------------------


class SummarizeRequest(CamelModel):
    meeting_id: str
    meta: MeetingMeta
    segments: list[TranscriptSegment] = Field(max_length=2000)


class EmbedRequest(CamelModel):
    workspace_id: str
    meeting_id: str
    segments: list[TranscriptSegment] = Field(max_length=2000)


class EmbedResponse(CamelModel):
    embedded: int
    usage: TokenUsageOut | None = None


class ChatRequest(CamelModel):
    workspace_id: str
    meeting_id: str | None = None
    question: str = Field(max_length=8000)
    history: list[ChatMessage] = Field(default_factory=list, max_length=20)


class ChatResponse(CamelModel):
    answer: str
    citations: list[Citation] = Field(default_factory=list)
    usage: TokenUsageOut | None = None


class AssistRequest(CamelModel):
    meeting_id: str | None = None
    segments: list[TranscriptSegment] = Field(default_factory=list)


class AssistResponse(CamelModel):
    summary_so_far: str = ""
    suggested_questions: list[str] = Field(default_factory=list)
    coverage_gaps: list[str] = Field(default_factory=list)
    segment_count: int = 0


class HealthResponse(CamelModel):
    status: str
    mode: str
    provider_order: list[str]
    providers_available: list[str]
    database: str


# --- Error envelope --------------------------------------------------------


class ErrorBody(CamelModel):
    code: str
    message: str


class ErrorEnvelope(CamelModel):
    error: ErrorBody
