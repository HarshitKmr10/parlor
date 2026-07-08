"""Provider abstraction for LLM completion + embeddings.

Each concrete provider implements three async operations:

* ``complete_json`` — return a JSON string constrained to a schema (structured
  output / tool-use style), used by summarization.
* ``complete_text`` — return free-form text, used by chat answers.
* ``embed`` — return one embedding vector per input string.

Providers raise :class:`ProviderError` on any failure so the router can fall
through to the next provider in ``AI_PROVIDER_ORDER``.
"""

from __future__ import annotations

import abc
from dataclasses import dataclass
from typing import Any


class ProviderError(RuntimeError):
    """Raised when a provider call fails (network, auth, parse, timeout)."""

    def __init__(self, provider: str, message: str) -> None:
        super().__init__(f"[{provider}] {message}")
        self.provider = provider
        self.message = message


@dataclass(frozen=True)
class TokenUsage:
    """Token accounting for a single LLM/embedding call.

    Pure observability -- this is surfaced to callers (and eventually the
    product's usage UI) so users can see their own consumption. It is never
    used to gate functionality, and nothing here is persisted; the backend
    reads it off the HTTP response if/when it wants to store it.
    """

    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    provider: str
    model: str


class LLMProvider(abc.ABC):
    """Common interface for all LLM/embedding providers."""

    name: str = "base"
    supports_embeddings: bool = True

    @abc.abstractmethod
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
        """Return a JSON string conforming to ``schema``.

        ``mock_context`` is only consumed by :class:`MockProvider`; live
        providers accept and ignore it so the router can pass it uniformly
        to whichever provider ends up handling the call.
        """

    @abc.abstractmethod
    async def complete_text(
        self,
        *,
        system: str,
        user: str,
        premium: bool = True,
        max_tokens: int = 2000,
        mock_context: dict[str, Any] | None = None,
    ) -> str:
        """Return a free-form text completion. See ``complete_json`` for
        ``mock_context``."""

    @abc.abstractmethod
    async def embed(self, texts: list[str]) -> list[list[float]]:
        """Return one embedding vector per input string."""

    # -- Usage-capturing variants ------------------------------------------
    #
    # These are additive: they default to wrapping the plain method above
    # with a zero-valued :class:`TokenUsage` so existing subclasses (real
    # providers written before usage tracking existed, and test doubles)
    # keep working unmodified. Providers that can report real usage override
    # these directly -- their plain method above then delegates to the
    # ``_with_usage`` variant so the underlying SDK call happens exactly
    # once per request either way.

    async def complete_json_with_usage(
        self,
        *,
        system: str,
        user: str,
        schema: dict[str, Any],
        premium: bool = True,
        max_tokens: int = 8000,
        mock_context: dict[str, Any] | None = None,
    ) -> tuple[str, TokenUsage]:
        content = await self.complete_json(
            system=system,
            user=user,
            schema=schema,
            premium=premium,
            max_tokens=max_tokens,
            mock_context=mock_context,
        )
        return content, TokenUsage(0, 0, 0, self.name, "unknown")

    async def complete_text_with_usage(
        self,
        *,
        system: str,
        user: str,
        premium: bool = True,
        max_tokens: int = 2000,
        mock_context: dict[str, Any] | None = None,
    ) -> tuple[str, TokenUsage]:
        content = await self.complete_text(
            system=system,
            user=user,
            premium=premium,
            max_tokens=max_tokens,
            mock_context=mock_context,
        )
        return content, TokenUsage(0, 0, 0, self.name, "unknown")

    async def embed_with_usage(self, texts: list[str]) -> tuple[list[list[float]], TokenUsage]:
        vectors = await self.embed(texts)
        return vectors, TokenUsage(0, 0, 0, self.name, "unknown")
