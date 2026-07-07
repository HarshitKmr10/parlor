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
from typing import Any


class ProviderError(RuntimeError):
    """Raised when a provider call fails (network, auth, parse, timeout)."""

    def __init__(self, provider: str, message: str) -> None:
        super().__init__(f"[{provider}] {message}")
        self.provider = provider
        self.message = message


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
