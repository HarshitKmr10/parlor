"""Unit tests for provider-level configuration flexibility:

* the generic OpenAI-compatible provider (OpenRouter / self-hosted) is built
  from its dedicated env-derived settings and participates in the router
  chain only when configured;
* Azure OpenAI routes premium vs. cheap calls to their respective deployments,
  falling back to the premium deployment when no cheap deployment is set.

No network calls are made: the Azure client's ``chat.completions.create`` is
replaced with an ``AsyncMock`` after construction, mirroring how
``tests/test_router.py`` injects fake provider doubles without touching the
real SDK clients.
"""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from app.config import Settings
from app.providers.azure_openai_provider import AzureOpenAIProvider
from app.providers.openai_compatible_provider import OpenAICompatibleProvider
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


def _chat_response(content: str = "ok"):
    class _Msg:
        def __init__(self, content: str) -> None:
            self.content = content

    class _Choice:
        def __init__(self, content: str) -> None:
            self.message = _Msg(content)

    class _Response:
        def __init__(self, content: str) -> None:
            self.choices = [_Choice(content)]

    return _Response(content)


class TestOpenAICompatibleProviderWiring:
    def test_participates_in_chain_when_base_url_is_configured(self):
        settings = _live_settings(
            provider_order=["openai_compatible"],
            openai_compatible_base_url="http://localhost:11434/v1",
            openai_compatible_api_key=None,
            openai_compatible_model="llama3.1",
        )

        router = ProviderRouter(settings)

        assert len(router._live) == 1  # noqa: SLF001
        provider = router._live[0]  # noqa: SLF001
        assert isinstance(provider, OpenAICompatibleProvider)
        assert provider.name == "openai_compatible"
        assert provider._model_name == "llama3.1"  # noqa: SLF001
        assert str(provider._client.base_url).startswith(  # noqa: SLF001
            "http://localhost:11434/v1"
        )

    def test_absent_from_chain_when_base_url_is_unset(self):
        settings = _live_settings(
            provider_order=["openai_compatible"],
            openai_compatible_base_url=None,
        )

        router = ProviderRouter(settings)

        assert router._live == []  # noqa: SLF001

    def test_uses_placeholder_api_key_when_none_configured(self):
        """Self-hosted servers (Ollama, LM Studio) often need no real key, but
        the openai SDK client requires a non-empty string."""
        provider = OpenAICompatibleProvider(
            base_url="http://localhost:8000/v1", api_key=None, model="local-model"
        )

        assert provider._client.api_key == "not-needed"  # noqa: SLF001

    def test_uses_the_configured_api_key_when_present(self):
        provider = OpenAICompatibleProvider(
            base_url="https://openrouter.ai/api/v1",
            api_key="sk-or-real-key",
            model="anthropic/claude-3.5-sonnet",
        )

        assert provider._client.api_key == "sk-or-real-key"  # noqa: SLF001

    @pytest.mark.asyncio
    async def test_complete_text_uses_the_configured_model(self):
        provider = OpenAICompatibleProvider(
            base_url="http://localhost:11434/v1", api_key=None, model="llama3.1"
        )
        provider._client.chat.completions.create = AsyncMock(  # noqa: SLF001
            return_value=_chat_response("hello")
        )

        result = await provider.complete_text(system="s", user="u")

        assert result == "hello"
        _, kwargs = provider._client.chat.completions.create.call_args  # noqa: SLF001
        assert kwargs["model"] == "llama3.1"


class TestAzureCheapPremiumRouting:
    @pytest.mark.asyncio
    async def test_premium_call_uses_the_premium_deployment(self):
        provider = AzureOpenAIProvider(
            endpoint="https://example.openai.azure.com",
            api_key="key",
            deployment="premium-deployment",
            cheap_deployment="cheap-deployment",
        )
        provider._client.chat.completions.create = AsyncMock(  # noqa: SLF001
            return_value=_chat_response()
        )

        await provider.complete_text(system="s", user="u", premium=True)

        _, kwargs = provider._client.chat.completions.create.call_args  # noqa: SLF001
        assert kwargs["model"] == "premium-deployment"

    @pytest.mark.asyncio
    async def test_cheap_call_uses_the_cheap_deployment(self):
        provider = AzureOpenAIProvider(
            endpoint="https://example.openai.azure.com",
            api_key="key",
            deployment="premium-deployment",
            cheap_deployment="cheap-deployment",
        )
        provider._client.chat.completions.create = AsyncMock(  # noqa: SLF001
            return_value=_chat_response()
        )

        await provider.complete_text(system="s", user="u", premium=False)

        _, kwargs = provider._client.chat.completions.create.call_args  # noqa: SLF001
        assert kwargs["model"] == "cheap-deployment"

    @pytest.mark.asyncio
    async def test_cheap_call_falls_back_to_premium_deployment_when_unset(self):
        """Preserves the pre-existing behavior of reusing one deployment for
        both tiers when a dedicated cheap deployment isn't configured."""
        provider = AzureOpenAIProvider(
            endpoint="https://example.openai.azure.com",
            api_key="key",
            deployment="premium-deployment",
            cheap_deployment=None,
        )
        provider._client.chat.completions.create = AsyncMock(  # noqa: SLF001
            return_value=_chat_response()
        )

        await provider.complete_text(system="s", user="u", premium=False)

        _, kwargs = provider._client.chat.completions.create.call_args  # noqa: SLF001
        assert kwargs["model"] == "premium-deployment"

    def test_router_wires_the_cheap_deployment_from_settings(self):
        settings = _live_settings(
            provider_order=["azure"],
            azure_openai_endpoint="https://example.openai.azure.com",
            azure_openai_api_key="key",
            azure_openai_deployment="premium-deployment",
            azure_openai_cheap_deployment="cheap-deployment",
        )

        router = ProviderRouter(settings)

        provider = router._live[0]  # noqa: SLF001
        assert isinstance(provider, AzureOpenAIProvider)
        assert provider._model(premium=True) == "premium-deployment"  # noqa: SLF001
        assert provider._model(premium=False) == "cheap-deployment"  # noqa: SLF001
