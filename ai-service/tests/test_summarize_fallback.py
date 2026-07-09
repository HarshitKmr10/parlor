"""Pinning test: a schema-invalid response from the top provider must fall
through to the next provider in the chain instead of retrying the same one.
"""

from __future__ import annotations

import pytest

from app.config import Settings
from app.providers.base import LLMProvider, ProviderError
from app.providers.router import ProviderRouter
from app.rag.summarize import _summarize_once
from app.schemas import MeetingInsights


def _live_settings() -> Settings:
    return Settings(
        anthropic_api_key=None,
        openai_api_key=None,
        gemini_api_key=None,
        azure_openai_endpoint=None,
        azure_openai_api_key=None,
        azure_openai_api_version="2024-02-15-preview",
        azure_openai_deployment="gpt-5.4-mini",
        azure_openai_embedding_deployment=None,
        provider_order=[],
        database_url=None,
        mode="live",
    )


_GOOD_INSIGHTS_JSON = (
    '{"summary": "s", "keyPoints": [], "actionItems": [], "chapters": []}'
)


class _JsonFakeProvider(LLMProvider):
    def __init__(self, name: str, *, raw: str) -> None:
        self.name = name
        self._raw = raw
        self.calls = 0

    async def complete_json(self, **_kwargs) -> str:
        self.calls += 1
        return self._raw

    async def complete_text(self, **_kwargs) -> str:
        raise ProviderError(self.name, "not used")

    async def embed(self, texts: list[str]) -> list[list[float]]:
        raise ProviderError(self.name, "not used")


@pytest.mark.asyncio
async def test_summarize_once_falls_through_on_bad_json_from_first_provider():
    router = ProviderRouter(_live_settings())
    bad = _JsonFakeProvider("bad-provider", raw="not valid json")
    good = _JsonFakeProvider("good-provider", raw=_GOOD_INSIGHTS_JSON)
    router._live = [bad, good]  # noqa: SLF001 - test seam

    result = await _summarize_once(
        router, title="Standup", body="transcript body", mock_context={}
    )

    assert isinstance(result, MeetingInsights)
    assert result.summary == "s"
    assert bad.calls == 1
    assert good.calls == 1
