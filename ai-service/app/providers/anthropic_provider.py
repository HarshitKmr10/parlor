"""Anthropic Claude provider using the official ``anthropic`` SDK.

Structured output is obtained via tool-use (a single forced tool whose input
schema is the requested JSON schema), which is reliably parseable. Anthropic
does not serve embeddings, so :meth:`embed` raises ``ProviderError`` to let the
router fall through to a provider that does (OpenAI) or to the mock embedder.
"""

from __future__ import annotations

import json
from typing import Any

import anthropic

from ..config import (
    ANTHROPIC_CHEAP_MODEL,
    ANTHROPIC_PREMIUM_MODEL,
    PROVIDER_TIMEOUT,
)
from .base import LLMProvider, ProviderError, TokenUsage

_STRUCTURED_TOOL_NAME = "emit_result"


class AnthropicProvider(LLMProvider):
    name = "anthropic"
    supports_embeddings = False

    def __init__(
        self,
        api_key: str,
        *,
        premium_model: str = ANTHROPIC_PREMIUM_MODEL,
        cheap_model: str = ANTHROPIC_CHEAP_MODEL,
    ) -> None:
        self._client = anthropic.AsyncAnthropic(
            api_key=api_key, timeout=PROVIDER_TIMEOUT, max_retries=0
        )
        self._premium_model = premium_model
        self._cheap_model = cheap_model

    def _model(self, premium: bool) -> str:
        return self._premium_model if premium else self._cheap_model

    async def complete_json(
        self,
        *,
        system: str,
        user: str,
        schema: dict[str, Any],
        premium: bool = True,
        max_tokens: int = 8000,
        mock_context: dict[str, Any] | None = None,  # noqa: ARG002 - mock-only
    ) -> str:
        content, _usage = await self.complete_json_with_usage(
            system=system,
            user=user,
            schema=schema,
            premium=premium,
            max_tokens=max_tokens,
            mock_context=mock_context,
        )
        return content

    async def complete_json_with_usage(
        self,
        *,
        system: str,
        user: str,
        schema: dict[str, Any],
        premium: bool = True,
        max_tokens: int = 8000,
        mock_context: dict[str, Any] | None = None,  # noqa: ARG002 - mock-only
    ) -> tuple[str, TokenUsage]:
        try:
            response = await self._client.messages.create(
                model=self._model(premium),
                max_tokens=max_tokens,
                system=system,
                tools=[
                    {
                        "name": _STRUCTURED_TOOL_NAME,
                        "description": "Emit the structured result.",
                        "input_schema": schema,
                    }
                ],
                tool_choice={"type": "tool", "name": _STRUCTURED_TOOL_NAME},
                messages=[{"role": "user", "content": user}],
            )
        except anthropic.APIError as exc:  # network, auth, rate limit, 5xx
            raise ProviderError(self.name, str(exc)) from exc
        except Exception as exc:  # defensive: any unexpected SDK failure
            raise ProviderError(self.name, str(exc)) from exc

        usage = self._usage_from_response(response, premium)
        for block in response.content:
            if block.type == "tool_use" and block.name == _STRUCTURED_TOOL_NAME:
                return json.dumps(block.input), usage
        raise ProviderError(self.name, "no tool_use block in response")

    async def complete_text(
        self,
        *,
        system: str,
        user: str,
        premium: bool = True,
        max_tokens: int = 2000,
        mock_context: dict[str, Any] | None = None,  # noqa: ARG002 - mock-only
    ) -> str:
        content, _usage = await self.complete_text_with_usage(
            system=system,
            user=user,
            premium=premium,
            max_tokens=max_tokens,
            mock_context=mock_context,
        )
        return content

    async def complete_text_with_usage(
        self,
        *,
        system: str,
        user: str,
        premium: bool = True,
        max_tokens: int = 2000,
        mock_context: dict[str, Any] | None = None,  # noqa: ARG002 - mock-only
    ) -> tuple[str, TokenUsage]:
        try:
            response = await self._client.messages.create(
                model=self._model(premium),
                max_tokens=max_tokens,
                system=system,
                messages=[{"role": "user", "content": user}],
            )
        except anthropic.APIError as exc:
            raise ProviderError(self.name, str(exc)) from exc
        except Exception as exc:
            raise ProviderError(self.name, str(exc)) from exc

        parts = [b.text for b in response.content if b.type == "text"]
        if not parts:
            raise ProviderError(self.name, "no text block in response")
        return "".join(parts), self._usage_from_response(response, premium)

    def _usage_from_response(self, response: Any, premium: bool) -> TokenUsage:
        input_tokens = response.usage.input_tokens
        output_tokens = response.usage.output_tokens
        return TokenUsage(
            prompt_tokens=input_tokens,
            completion_tokens=output_tokens,
            total_tokens=input_tokens + output_tokens,
            provider=self.name,
            model=self._model(premium),
        )

    async def embed(self, texts: list[str]) -> list[list[float]]:
        # Anthropic has no embeddings endpoint; signal fall-through.
        raise ProviderError(self.name, "embeddings not supported by Anthropic")
