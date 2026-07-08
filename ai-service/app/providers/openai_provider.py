"""OpenAI provider using the official ``openai`` SDK.

Structured output uses ``response_format`` with a JSON schema. Embeddings use
``text-embedding-3-small`` (1536 dims).
"""

from __future__ import annotations

from typing import Any

import openai

from ..config import (
    EMBEDDING_DIM,
    OPENAI_CHEAP_MODEL,
    OPENAI_EMBEDDING_MODEL,
    OPENAI_PREMIUM_MODEL,
    PROVIDER_TIMEOUT,
)
from .base import LLMProvider, ProviderError, TokenUsage


class OpenAIProvider(LLMProvider):
    name = "openai"

    def __init__(
        self,
        api_key: str,
        *,
        premium_model: str = OPENAI_PREMIUM_MODEL,
        cheap_model: str = OPENAI_CHEAP_MODEL,
    ) -> None:
        self._client = openai.AsyncOpenAI(
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
            response = await self._client.chat.completions.create(
                model=self._model(premium),
                max_tokens=max_tokens,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                response_format={
                    "type": "json_schema",
                    "json_schema": {
                        "name": "result",
                        "schema": schema,
                        "strict": False,
                    },
                },
            )
        except openai.OpenAIError as exc:
            raise ProviderError(self.name, str(exc)) from exc
        except Exception as exc:
            raise ProviderError(self.name, str(exc)) from exc

        content = response.choices[0].message.content
        if not content:
            raise ProviderError(self.name, "empty completion content")
        return content, self._usage_from_response(response, premium)

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
            response = await self._client.chat.completions.create(
                model=self._model(premium),
                max_tokens=max_tokens,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
            )
        except openai.OpenAIError as exc:
            raise ProviderError(self.name, str(exc)) from exc
        except Exception as exc:
            raise ProviderError(self.name, str(exc)) from exc

        content = response.choices[0].message.content
        if not content:
            raise ProviderError(self.name, "empty completion content")
        return content, self._usage_from_response(response, premium)

    def _usage_from_response(self, response: Any, premium: bool) -> TokenUsage:
        # Read defensively: the real SDK always populates ``usage``, but test
        # doubles may omit it.
        usage = getattr(response, "usage", None)
        if usage is None:
            return TokenUsage(0, 0, 0, self.name, self._model(premium))
        return TokenUsage(
            prompt_tokens=usage.prompt_tokens,
            completion_tokens=usage.completion_tokens,
            total_tokens=usage.total_tokens,
            provider=self.name,
            model=self._model(premium),
        )

    async def embed(self, texts: list[str]) -> list[list[float]]:
        vectors, _usage = await self.embed_with_usage(texts)
        return vectors

    async def embed_with_usage(self, texts: list[str]) -> tuple[list[list[float]], TokenUsage]:
        if not texts:
            return [], TokenUsage(0, 0, 0, self.name, OPENAI_EMBEDDING_MODEL)
        try:
            response = await self._client.embeddings.create(
                model=OPENAI_EMBEDDING_MODEL,
                input=texts,
                dimensions=EMBEDDING_DIM,
            )
        except openai.OpenAIError as exc:
            raise ProviderError(self.name, str(exc)) from exc
        except Exception as exc:
            raise ProviderError(self.name, str(exc)) from exc

        usage = TokenUsage(
            prompt_tokens=response.usage.prompt_tokens,
            completion_tokens=0,
            total_tokens=response.usage.total_tokens,
            provider=self.name,
            model=OPENAI_EMBEDDING_MODEL,
        )
        return [item.embedding for item in response.data], usage
