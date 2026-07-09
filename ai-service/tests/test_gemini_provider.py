"""Unit tests for GeminiProvider (app.providers.gemini_provider).

No network calls are made: the ``google-genai`` client's async methods
(``client.aio.models.generate_content`` / ``embed_content``) are replaced
with ``AsyncMock`` after construction, mirroring how
``tests/test_provider_config.py`` mocks the Azure/OpenAI-compatible SDK
clients and ``tests/test_router.py`` injects fake provider doubles.
"""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from app.config import Settings
from app.providers.base import ProviderError
from app.providers.gemini_provider import GeminiProvider
from app.providers.router import ProviderRouter


def _live_settings(**overrides) -> Settings:
    base = dict(
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
    base.update(overrides)
    return Settings(**base)


class _Usage:
    def __init__(self, prompt=10, candidates=5, total=15):
        self.prompt_token_count = prompt
        self.candidates_token_count = candidates
        self.total_token_count = total


class _GenerateResponse:
    def __init__(self, text: str, usage_metadata=None):
        self.text = text
        self.usage_metadata = usage_metadata if usage_metadata is not None else _Usage()


class _Stats:
    def __init__(self, token_count: float | None):
        self.token_count = token_count


class _Embedding:
    def __init__(self, values: list[float], token_count: float | None = None):
        self.values = values
        self.statistics = _Stats(token_count) if token_count is not None else None


class _EmbedResponse:
    def __init__(self, embeddings: list[_Embedding]):
        self.embeddings = embeddings


class TestGeminiProviderCompleteJson:
    @pytest.mark.asyncio
    async def test_returns_content_from_generate_content(self):
        provider = GeminiProvider("api-key")
        provider._client.aio.models.generate_content = AsyncMock(  # noqa: SLF001
            return_value=_GenerateResponse('{"ok": true}')
        )

        result = await provider.complete_json(
            system="s", user="u", schema={"type": "object"}
        )

        assert result == '{"ok": true}'
        _, kwargs = provider._client.aio.models.generate_content.call_args  # noqa: SLF001
        assert kwargs["config"].response_mime_type == "application/json"
        assert kwargs["config"].response_json_schema == {"type": "object"}

    @pytest.mark.asyncio
    async def test_uses_premium_model_by_default(self):
        provider = GeminiProvider(
            "api-key", premium_model="gemini-premium", cheap_model="gemini-cheap"
        )
        provider._client.aio.models.generate_content = AsyncMock(  # noqa: SLF001
            return_value=_GenerateResponse('{"ok": true}')
        )

        await provider.complete_json(system="s", user="u", schema={"type": "object"})

        _, kwargs = provider._client.aio.models.generate_content.call_args  # noqa: SLF001
        assert kwargs["model"] == "gemini-premium"

    @pytest.mark.asyncio
    async def test_uses_cheap_model_when_not_premium(self):
        provider = GeminiProvider(
            "api-key", premium_model="gemini-premium", cheap_model="gemini-cheap"
        )
        provider._client.aio.models.generate_content = AsyncMock(  # noqa: SLF001
            return_value=_GenerateResponse('{"ok": true}')
        )

        await provider.complete_json(
            system="s", user="u", schema={"type": "object"}, premium=False
        )

        _, kwargs = provider._client.aio.models.generate_content.call_args  # noqa: SLF001
        assert kwargs["model"] == "gemini-cheap"

    @pytest.mark.asyncio
    async def test_raises_provider_error_on_sdk_failure(self):
        provider = GeminiProvider("api-key")
        provider._client.aio.models.generate_content = AsyncMock(  # noqa: SLF001
            side_effect=RuntimeError("boom")
        )

        with pytest.raises(ProviderError, match="boom"):
            await provider.complete_json(system="s", user="u", schema={"type": "object"})

    @pytest.mark.asyncio
    async def test_raises_provider_error_on_empty_content(self):
        provider = GeminiProvider("api-key")
        provider._client.aio.models.generate_content = AsyncMock(  # noqa: SLF001
            return_value=_GenerateResponse("")
        )

        with pytest.raises(ProviderError, match="empty completion content"):
            await provider.complete_json(system="s", user="u", schema={"type": "object"})

    @pytest.mark.asyncio
    async def test_captures_real_token_usage(self):
        provider = GeminiProvider("api-key", premium_model="gemini-premium")
        provider._client.aio.models.generate_content = AsyncMock(  # noqa: SLF001
            return_value=_GenerateResponse(
                '{"ok": true}', usage_metadata=_Usage(prompt=7, candidates=3, total=10)
            )
        )

        _content, usage = await provider.complete_json_with_usage(
            system="s", user="u", schema={"type": "object"}
        )

        assert usage.prompt_tokens == 7
        assert usage.completion_tokens == 3
        assert usage.total_tokens == 10
        assert usage.provider == "gemini"
        assert usage.model == "gemini-premium"


class TestGeminiProviderCompleteText:
    @pytest.mark.asyncio
    async def test_returns_text_from_generate_content(self):
        provider = GeminiProvider("api-key")
        provider._client.aio.models.generate_content = AsyncMock(  # noqa: SLF001
            return_value=_GenerateResponse("hello there")
        )

        result = await provider.complete_text(system="s", user="u")

        assert result == "hello there"
        _, kwargs = provider._client.aio.models.generate_content.call_args  # noqa: SLF001
        assert kwargs["config"].response_mime_type is None

    @pytest.mark.asyncio
    async def test_raises_provider_error_on_sdk_failure(self):
        provider = GeminiProvider("api-key")
        provider._client.aio.models.generate_content = AsyncMock(  # noqa: SLF001
            side_effect=RuntimeError("boom")
        )

        with pytest.raises(ProviderError, match="boom"):
            await provider.complete_text(system="s", user="u")


class TestGeminiProviderEmbed:
    @pytest.mark.asyncio
    async def test_returns_one_vector_per_input(self):
        provider = GeminiProvider("api-key")
        provider._client.aio.models.embed_content = AsyncMock(  # noqa: SLF001
            return_value=_EmbedResponse(
                [_Embedding([0.1, 0.2]), _Embedding([0.3, 0.4])]
            )
        )

        result = await provider.embed(["a", "b"])

        assert result == [[0.1, 0.2], [0.3, 0.4]]

    @pytest.mark.asyncio
    async def test_empty_input_short_circuits_without_calling_sdk(self):
        provider = GeminiProvider("api-key")
        provider._client.aio.models.embed_content = AsyncMock()  # noqa: SLF001

        result = await provider.embed([])

        assert result == []
        provider._client.aio.models.embed_content.assert_not_called()  # noqa: SLF001

    @pytest.mark.asyncio
    async def test_raises_provider_error_on_sdk_failure(self):
        provider = GeminiProvider("api-key")
        provider._client.aio.models.embed_content = AsyncMock(  # noqa: SLF001
            side_effect=RuntimeError("boom")
        )

        with pytest.raises(ProviderError, match="boom"):
            await provider.embed(["a"])

    @pytest.mark.asyncio
    async def test_raises_provider_error_on_embedding_count_mismatch(self):
        provider = GeminiProvider("api-key")
        provider._client.aio.models.embed_content = AsyncMock(  # noqa: SLF001
            return_value=_EmbedResponse([_Embedding([0.1, 0.2])])
        )

        with pytest.raises(ProviderError, match="expected 2 embeddings"):
            await provider.embed(["a", "b"])

    @pytest.mark.asyncio
    async def test_sums_per_item_token_counts_into_usage(self):
        provider = GeminiProvider("api-key")
        provider._client.aio.models.embed_content = AsyncMock(  # noqa: SLF001
            return_value=_EmbedResponse(
                [
                    _Embedding([0.1], token_count=4),
                    _Embedding([0.2], token_count=6),
                ]
            )
        )

        _vectors, usage = await provider.embed_with_usage(["a", "b"])

        assert usage.prompt_tokens == 10
        assert usage.total_tokens == 10
        assert usage.provider == "gemini"

    @pytest.mark.asyncio
    async def test_usage_defaults_to_zero_when_statistics_absent(self):
        """The Gemini Developer API doesn't surface per-item token counts
        (that's an Enterprise-only field) -- usage should degrade to zero
        rather than raise."""
        provider = GeminiProvider("api-key")
        provider._client.aio.models.embed_content = AsyncMock(  # noqa: SLF001
            return_value=_EmbedResponse([_Embedding([0.1]), _Embedding([0.2])])
        )

        _vectors, usage = await provider.embed_with_usage(["a", "b"])

        assert usage.prompt_tokens == 0
        assert usage.total_tokens == 0


class TestGeminiProviderRouterWiring:
    def test_participates_in_chain_when_api_key_is_configured(self):
        settings = _live_settings(
            provider_order=["gemini"],
            gemini_api_key="gemini-key",
        )

        router = ProviderRouter(settings)

        assert len(router._live) == 1  # noqa: SLF001
        provider = router._live[0]  # noqa: SLF001
        assert isinstance(provider, GeminiProvider)
        assert provider.name == "gemini"

    def test_absent_from_chain_when_api_key_is_unset(self):
        settings = _live_settings(
            provider_order=["gemini"],
            gemini_api_key=None,
        )

        router = ProviderRouter(settings)

        assert router._live == []  # noqa: SLF001

    def test_not_included_in_default_provider_order(self):
        """Gemini must be available when configured, but not force-added to
        the default AI_PROVIDER_ORDER (azure,anthropic,openai) -- consistent
        with how openai_compatible also isn't in the default order."""
        from app.config import load_settings

        default_order = load_settings().provider_order
        assert "gemini" not in default_order
