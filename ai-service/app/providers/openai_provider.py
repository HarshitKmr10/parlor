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
from .base import LLMProvider, ProviderError


class OpenAIProvider(LLMProvider):
    name = "openai"

    def __init__(self, api_key: str) -> None:
        self._client = openai.AsyncOpenAI(
            api_key=api_key, timeout=PROVIDER_TIMEOUT, max_retries=0
        )

    def _model(self, premium: bool) -> str:
        return OPENAI_PREMIUM_MODEL if premium else OPENAI_CHEAP_MODEL

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
        return content

    async def complete_text(
        self,
        *,
        system: str,
        user: str,
        premium: bool = True,
        max_tokens: int = 2000,
        mock_context: dict[str, Any] | None = None,  # noqa: ARG002 - mock-only
    ) -> str:
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
        return content

    async def embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
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

        return [item.embedding for item in response.data]
