"""Unit tests for TokenUsage capture and cost estimation.

Covers:
* each live provider extracts real ``usage`` fields off its SDK response into
  a :class:`TokenUsage` via the ``*_with_usage`` methods;
* the mock provider produces deterministic, proportional usage numbers
  without any network access;
* ``estimate_cost_usd`` returns a sensible number for known models and
  ``None`` (never raises) for unknown ones.
"""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from app.providers.anthropic_provider import AnthropicProvider
from app.providers.azure_openai_provider import AzureOpenAIProvider
from app.providers.base import TokenUsage
from app.providers.mock_provider import MockProvider
from app.providers.openai_compatible_provider import OpenAICompatibleProvider
from app.providers.openai_provider import OpenAIProvider
from app.providers.pricing import estimate_cost_usd


def _openai_chat_response(content: str, prompt_tokens: int, completion_tokens: int):
    class _Usage:
        def __init__(self) -> None:
            self.prompt_tokens = prompt_tokens
            self.completion_tokens = completion_tokens
            self.total_tokens = prompt_tokens + completion_tokens

    class _Msg:
        def __init__(self, content: str) -> None:
            self.content = content

    class _Choice:
        def __init__(self, content: str) -> None:
            self.message = _Msg(content)

    class _Response:
        def __init__(self, content: str) -> None:
            self.choices = [_Choice(content)]
            self.usage = _Usage()

    return _Response(content)


def _anthropic_response(input_tokens: int, output_tokens: int, tool_input: dict):
    class _Usage:
        def __init__(self) -> None:
            self.input_tokens = input_tokens
            self.output_tokens = output_tokens

    class _Block:
        def __init__(self, tool_input: dict) -> None:
            self.type = "tool_use"
            self.name = "emit_result"
            self.input = tool_input

    class _Response:
        def __init__(self) -> None:
            self.content = [_Block(tool_input)]
            self.usage = _Usage()

    return _Response()


class TestOpenAIProviderUsage:
    @pytest.mark.asyncio
    async def test_complete_text_with_usage_reports_real_token_counts(self):
        provider = OpenAIProvider("fake-key")
        provider._client.chat.completions.create = AsyncMock(  # noqa: SLF001
            return_value=_openai_chat_response("hello", prompt_tokens=42, completion_tokens=7)
        )

        content, usage = await provider.complete_text_with_usage(system="s", user="u")

        assert content == "hello"
        assert usage == TokenUsage(42, 7, 49, "openai", provider._premium_model)  # noqa: SLF001

    @pytest.mark.asyncio
    async def test_complete_text_still_returns_plain_string(self):
        """The pre-existing plain method must keep its original return type."""
        provider = OpenAIProvider("fake-key")
        provider._client.chat.completions.create = AsyncMock(  # noqa: SLF001
            return_value=_openai_chat_response("hello", prompt_tokens=1, completion_tokens=1)
        )

        result = await provider.complete_text(system="s", user="u")

        assert result == "hello"


class TestAzureProviderUsage:
    @pytest.mark.asyncio
    async def test_complete_json_with_usage_reports_real_token_counts(self):
        provider = AzureOpenAIProvider(
            endpoint="https://example.openai.azure.com",
            api_key="key",
            deployment="premium-deployment",
        )
        provider._client.chat.completions.create = AsyncMock(  # noqa: SLF001
            return_value=_openai_chat_response(
                '{"ok": true}', prompt_tokens=100, completion_tokens=20
            )
        )

        content, usage = await provider.complete_json_with_usage(
            system="s", user="u", schema={"type": "object"}
        )

        assert content == '{"ok": true}'
        assert usage.prompt_tokens == 100
        assert usage.completion_tokens == 20
        assert usage.total_tokens == 120
        assert usage.provider == "azure"
        assert usage.model == "premium-deployment"


class TestOpenAICompatibleProviderUsage:
    @pytest.mark.asyncio
    async def test_complete_text_with_usage_reports_real_token_counts(self):
        provider = OpenAICompatibleProvider(
            base_url="http://localhost:11434/v1", api_key=None, model="llama3.1"
        )
        provider._client.chat.completions.create = AsyncMock(  # noqa: SLF001
            return_value=_openai_chat_response("hi", prompt_tokens=5, completion_tokens=3)
        )

        content, usage = await provider.complete_text_with_usage(system="s", user="u")

        assert content == "hi"
        assert usage == TokenUsage(5, 3, 8, "openai_compatible", "llama3.1")


class TestAnthropicProviderUsage:
    @pytest.mark.asyncio
    async def test_complete_json_with_usage_reports_real_token_counts(self, monkeypatch):
        provider = AnthropicProvider("fake-key")
        response = _anthropic_response(
            input_tokens=200, output_tokens=50, tool_input={"summary": "s"}
        )
        provider._client.messages.create = AsyncMock(return_value=response)  # noqa: SLF001

        content, usage = await provider.complete_json_with_usage(
            system="s", user="u", schema={"type": "object"}
        )

        assert content == '{"summary": "s"}'
        assert usage.prompt_tokens == 200
        assert usage.completion_tokens == 50
        assert usage.total_tokens == 250
        assert usage.provider == "anthropic"
        assert usage.model == provider._premium_model  # noqa: SLF001


class TestMockProviderUsage:
    @pytest.mark.asyncio
    async def test_complete_text_with_usage_is_deterministic_and_proportional(self):
        provider = MockProvider()

        _, short_usage = await provider.complete_text_with_usage(
            system="s", user="u", mock_context={"question": "q", "snippets": []}
        )
        _, long_usage = await provider.complete_text_with_usage(
            system="s",
            user="u" * 500,
            mock_context={"question": "q", "snippets": ["x" * 500]},
        )

        assert short_usage.provider == "mock"
        assert short_usage.prompt_tokens > 0
        assert long_usage.prompt_tokens > short_usage.prompt_tokens
        assert long_usage.completion_tokens > short_usage.completion_tokens

    @pytest.mark.asyncio
    async def test_complete_text_with_usage_never_calls_a_network(self):
        """No API keys are configured for MockProvider -- if this touched the
        network it would raise or hang; it must return purely from local
        computation."""
        provider = MockProvider()

        content, usage = await provider.complete_text_with_usage(
            system="s", user="hello", mock_context={"question": "hello", "snippets": []}
        )

        assert isinstance(content, str)
        assert usage.total_tokens == usage.prompt_tokens + usage.completion_tokens

    @pytest.mark.asyncio
    async def test_embed_with_usage_reports_zero_completion_tokens(self):
        provider = MockProvider()

        vectors, usage = await provider.embed_with_usage(["hello", "world"])

        assert len(vectors) == 2
        assert usage.completion_tokens == 0
        assert usage.total_tokens == usage.prompt_tokens


class TestEstimateCostUsd:
    def test_known_model_returns_a_positive_estimate(self):
        usage = TokenUsage(
            prompt_tokens=1_000_000,
            completion_tokens=1_000_000,
            total_tokens=2_000_000,
            provider="openai",
            model="gpt-4o-mini",
        )

        cost = estimate_cost_usd(usage)

        assert cost == pytest.approx(0.15 + 0.60)

    def test_unknown_model_returns_none_without_raising(self):
        usage = TokenUsage(
            prompt_tokens=100,
            completion_tokens=50,
            total_tokens=150,
            provider="openai_compatible",
            model="some/self-hosted-model-nobody-heard-of",
        )

        assert estimate_cost_usd(usage) is None

    def test_zero_usage_returns_zero_for_a_known_model(self):
        usage = TokenUsage(0, 0, 0, "openai", "gpt-4o")

        assert estimate_cost_usd(usage) == 0.0
