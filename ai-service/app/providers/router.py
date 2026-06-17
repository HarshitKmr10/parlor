"""Provider router: ordered fall-through across configured providers.

In ``live`` mode, providers are tried in ``AI_PROVIDER_ORDER`` and the first to
succeed wins; on :class:`ProviderError` the router falls through to the next.
If every live provider fails, it degrades to the mock provider so the request
still returns a structured (clearly labeled) response rather than a 5xx.

In ``mock`` mode only the mock provider is used.
"""

from __future__ import annotations

import logging
from typing import Any

from ..config import Settings
from .anthropic_provider import AnthropicProvider
from .azure_openai_provider import AzureOpenAIProvider
from .base import LLMProvider, ProviderError
from .mock_provider import MockProvider
from .openai_provider import OpenAIProvider

logger = logging.getLogger("ai-service.router")


class ProviderRouter:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._mock = MockProvider()
        self._live: list[LLMProvider] = []

        if not settings.is_mock:
            builders = {
                "azure": lambda: AzureOpenAIProvider(
                    endpoint=settings.azure_openai_endpoint,
                    api_key=settings.azure_openai_api_key,
                    api_version=settings.azure_openai_api_version,
                    deployment=settings.azure_openai_deployment,
                    embedding_deployment=settings.azure_openai_embedding_deployment,
                )
                if settings.azure_configured
                else None,
                "anthropic": lambda: AnthropicProvider(settings.anthropic_api_key)
                if settings.anthropic_api_key
                else None,
                "openai": lambda: OpenAIProvider(settings.openai_api_key)
                if settings.openai_api_key
                else None,
            }
            for name in settings.provider_order:
                build = builders.get(name)
                if build is None:
                    continue
                provider = build()
                if provider is not None:
                    self._live.append(provider)

    @property
    def available(self) -> list[str]:
        if self._settings.is_mock:
            return ["mock"]
        return [p.name for p in self._live] or ["mock"]

    @property
    def mock(self) -> MockProvider:
        return self._mock

    def _chain(self) -> list[LLMProvider]:
        if self._settings.is_mock or not self._live:
            return [self._mock]
        # Live providers first, mock as the final safety net.
        return [*self._live, self._mock]

    async def complete_json(
        self,
        *,
        system: str,
        user: str,
        schema: dict[str, Any],
        premium: bool = True,
        max_tokens: int = 8000,
        mock_context: dict[str, Any] | None = None,
    ) -> str:
        if mock_context is not None:
            self._mock.set_context(mock_context)
        last_error: ProviderError | None = None
        for provider in self._chain():
            try:
                return await provider.complete_json(
                    system=system,
                    user=user,
                    schema=schema,
                    premium=premium,
                    max_tokens=max_tokens,
                )
            except ProviderError as exc:
                logger.warning("complete_json failed on %s: %s", provider.name, exc)
                last_error = exc
        raise last_error or ProviderError("router", "no providers available")

    async def complete_text(
        self,
        *,
        system: str,
        user: str,
        premium: bool = True,
        max_tokens: int = 2000,
        mock_context: dict[str, Any] | None = None,
    ) -> str:
        if mock_context is not None:
            self._mock.set_context(mock_context)
        last_error: ProviderError | None = None
        for provider in self._chain():
            try:
                return await provider.complete_text(
                    system=system,
                    user=user,
                    premium=premium,
                    max_tokens=max_tokens,
                )
            except ProviderError as exc:
                logger.warning("complete_text failed on %s: %s", provider.name, exc)
                last_error = exc
        raise last_error or ProviderError("router", "no providers available")

    async def embed(self, texts: list[str]) -> list[list[float]]:
        last_error: ProviderError | None = None
        for provider in self._chain():
            try:
                return await provider.embed(texts)
            except ProviderError as exc:
                logger.warning("embed failed on %s: %s", provider.name, exc)
                last_error = exc
        raise last_error or ProviderError("router", "no providers available")
