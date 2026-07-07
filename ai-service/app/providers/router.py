"""Provider router: ordered fall-through across configured providers.

In ``live`` mode, providers are tried in ``AI_PROVIDER_ORDER`` and the first to
succeed wins; on :class:`ProviderError` the router falls through to the next.
If every live provider fails, it degrades to the mock provider so the request
still returns a structured (clearly labeled) response rather than a 5xx.

In ``mock`` mode only the mock provider is used.
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any, Awaitable, Callable, TypeVar

from ..config import REQUEST_TIME_BUDGET, Settings
from .anthropic_provider import AnthropicProvider
from .azure_openai_provider import AzureOpenAIProvider
from .base import LLMProvider, ProviderError
from .mock_provider import MockProvider
from .openai_provider import OpenAIProvider

logger = logging.getLogger("ai-service.router")

# A blank/whitespace-only segment text is not embeddable content but the
# embeddings API (e.g. OpenAI's) rejects an empty string outright, which would
# otherwise fail the *entire* batch call and silently degrade every segment in
# the request to mock vectors (see issue #22). Substituting a fixed, obviously
# non-content placeholder keeps live providers handling the rest of the batch.
_BLANK_SEGMENT_PLACEHOLDER = "(blank segment)"

_T = TypeVar("_T")


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

    async def _run_chain(
        self,
        attempt: Callable[[LLMProvider], Awaitable[_T]],
        *,
        op: str,
    ) -> _T:
        """Try ``attempt(provider)`` across ``self._chain()``, enforcing a
        total wall-clock budget (``REQUEST_TIME_BUDGET``) across the WHOLE
        chain rather than relying solely on each provider's own
        ``PROVIDER_TIMEOUT``.

        Without this, a hanging live provider can consume up to
        ``PROVIDER_TIMEOUT`` seconds before the router even tries the next
        one -- with several live providers chained, worst-case latency can
        exceed the backend caller's own HTTP timeout (issue #47). Once the
        budget is exhausted, remaining LIVE provider attempts are skipped;
        the mock provider (no I/O, effectively instant) still runs as the
        final safety net regardless of budget so the existing "never 5xx"
        behavior is preserved.
        """
        deadline = time.monotonic() + REQUEST_TIME_BUDGET
        last_error: ProviderError | None = None
        for provider in self._chain():
            if op == "embed" and not provider.supports_embeddings:
                # A deterministic, permanent incapability (e.g. Anthropic has
                # no embeddings endpoint) -- skip silently rather than attempt
                # and log a warning for a failure that can never succeed.
                continue
            remaining = deadline - time.monotonic()
            if provider is not self._mock and remaining <= 0:
                logger.warning(
                    "%s: time budget (%.1fs) exhausted before trying %s; "
                    "skipping to the next provider",
                    op,
                    REQUEST_TIME_BUDGET,
                    provider.name,
                )
                continue
            try:
                if provider is self._mock:
                    return await attempt(provider)
                return await asyncio.wait_for(attempt(provider), timeout=remaining)
            except (ProviderError, asyncio.TimeoutError) as exc:
                if isinstance(exc, asyncio.TimeoutError):
                    exc = ProviderError(
                        provider.name,
                        f"exceeded remaining time budget ({remaining:.1f}s)",
                    )
                logger.warning("%s failed on %s: %s", op, provider.name, exc)
                last_error = exc
        raise last_error or ProviderError("router", "no providers available")

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
        return await self._run_chain(
            lambda provider: provider.complete_json(
                system=system,
                user=user,
                schema=schema,
                premium=premium,
                max_tokens=max_tokens,
                mock_context=mock_context,
            ),
            op="complete_json",
        )

    async def complete_json_validated(
        self,
        *,
        system: str,
        user: str,
        schema: dict[str, Any],
        parse: Callable[[str], _T],
        premium: bool = True,
        max_tokens: int = 8000,
        mock_context: dict[str, Any] | None = None,
        op: str = "complete_json",
    ) -> _T:
        """Like :meth:`complete_json`, but folds the caller's own
        parse/validate step (e.g. ``json.loads`` + Pydantic
        ``model_validate``) into the fallback chain itself.

        Without this, a caller that retries a schema-invalid response by
        calling ``complete_json`` again starts a brand-new ``_run_chain``
        invocation at ``self._chain()[0]`` -- the same top-priority provider
        that just produced the bad output -- instead of advancing to the
        next provider in ``AI_PROVIDER_ORDER``. Here, a ``parse`` failure is
        treated exactly like a :class:`ProviderError` raised by the provider
        itself, so the *same* ``_run_chain`` call advances to the next
        provider, all the way down to the mock safety net if every live
        provider returns schema-invalid output.
        """

        async def attempt(provider: LLMProvider) -> _T:
            raw = await provider.complete_json(
                system=system,
                user=user,
                schema=schema,
                premium=premium,
                max_tokens=max_tokens,
                mock_context=mock_context,
            )
            try:
                return parse(raw)
            except Exception as exc:  # noqa: BLE001 - any parse/validation failure
                raise ProviderError(
                    provider.name, f"schema-invalid output: {exc}"
                ) from exc

        return await self._run_chain(attempt, op=op)

    async def complete_text(
        self,
        *,
        system: str,
        user: str,
        premium: bool = True,
        max_tokens: int = 2000,
        mock_context: dict[str, Any] | None = None,
    ) -> str:
        return await self._run_chain(
            lambda provider: provider.complete_text(
                system=system,
                user=user,
                premium=premium,
                max_tokens=max_tokens,
                mock_context=mock_context,
            ),
            op="complete_text",
        )

    async def embed(self, texts: list[str]) -> list[list[float]]:
        blank_count = sum(1 for t in texts if not t.strip())
        if blank_count:
            logger.warning(
                "embed: %d/%d segment(s) were blank/whitespace-only; substituting "
                "a placeholder so the rest of the batch still embeds via live "
                "providers instead of degrading the whole request to mock",
                blank_count,
                len(texts),
            )
        # Substitute a placeholder for blank entries (never drop them) so the
        # returned list stays positionally aligned with the caller's segments
        # — callers (e.g. EmbeddingStore.upsert_segments) zip embeddings back
        # onto segments by index.
        safe_texts = [t if t.strip() else _BLANK_SEGMENT_PLACEHOLDER for t in texts]

        return await self._run_chain(
            lambda provider: provider.embed(safe_texts),
            op="embed",
        )
