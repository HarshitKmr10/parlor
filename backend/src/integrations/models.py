"""Shared data models for the outbound integrations module."""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class _CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel, populate_by_name=True, from_attributes=True
    )


class MeetingRecap(_CamelModel):
    """The payload an integration provider renders + delivers."""

    meeting_id: str
    title: str
    summary: str = ""
    key_points: List[str] = Field(default_factory=list)
    action_items: List[str] = Field(default_factory=list)


class DeliveryResult(_CamelModel):
    """Outcome of delivering a recap through one provider."""

    kind: str
    delivered: bool
    detail: Optional[str] = None
