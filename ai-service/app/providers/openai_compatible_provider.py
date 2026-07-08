"""Generic OpenAI-Chat-Completions-API-compatible provider.

This single provider type is the integration point for **any** backend that
speaks the OpenAI chat-completions wire format with a custom ``base_url`` --
OpenRouter, and self-hosted model servers (vLLM, Ollama, LM Studio,
text-generation-webui, etc.) all qualify. Rather than writing a bespoke class
per vendor, the official ``openai`` Python SDK's native ``base_url``
parameter is reused as-is -- this is the standard integration pattern these
providers themselves document -- configured entirely from
``OPENAI_COMPATIBLE_BASE_URL`` / ``OPENAI_COMPATIBLE_API_KEY`` /
``OPENAI_COMPATIBLE_MODEL``. If another OpenAI-compatible vendor needs
support later, it should be a new ``.env`` value pointed at this same class,
not a new provider class.

Some self-hosted servers don't require a real API key; the SDK still needs a
non-empty string, so a placeholder is substituted when none is configured.

Structured output uses the same ``response_format`` JSON-schema mechanism as
:class:`app.providers.openai_provider.OpenAIProvider`; not every compatible
backend honors ``json_schema`` as strictly as hosted OpenAI, so callers
should expect looser schema adherence from some self-hosted models.
"""

from __future__ import annotations

from typing import Any

import openai

from ..config import PROVIDER_TIMEOUT
from .base import LLMProvider, ProviderError

_NO_KEY_PLACEHOLDER = "not-needed"


class OpenAICompatibleProvider(LLMProvider):
    name = "openai_compatible"

    def __init__(self, *, base_url: str, api_key: str | None, model: str) -> None:
        self._model_name = model
        self._client = openai.AsyncOpenAI(
            base_url=base_url,
            api_key=api_key or _NO_KEY_PLACEHOLDER,
            timeout=PROVIDER_TIMEOUT,
            max_retries=0,
        )

    def _model(self, premium: bool) -> str:  # noqa: ARG002 - single configured model
        return self._model_name

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
                model=self._model_name,
                input=texts,
            )
        except openai.OpenAIError as exc:
            raise ProviderError(self.name, str(exc)) from exc
        except Exception as exc:
            raise ProviderError(self.name, str(exc)) from exc

        return [item.embedding for item in response.data]
