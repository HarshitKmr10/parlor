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
from .base import LLMProvider, ProviderError, TokenUsage

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
        return content, self._usage_from_response(response)

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
        return content, self._usage_from_response(response)

    def _usage_from_response(self, response: Any) -> TokenUsage:
        # TODO: OpenRouter's response extends the standard OpenAI usage
        # object with a real per-request ``usage.cost`` field (in USD) on
        # some plans/models. When present it is a more accurate number than
        # our static pricing.py table (which cannot know the true cost of an
        # arbitrary routed/self-hosted model). We don't currently thread that
        # through as a distinct "actual cost" -- pricing.estimate_cost_usd
        # will just return None for unrecognized model ids -- but a future
        # pass could check ``getattr(response.usage, "cost", None)`` here and
        # surface it separately when this provider is pointed at OpenRouter.
        #
        # Read defensively: some self-hosted/non-conformant OpenAI-compatible
        # backends (and test doubles) may omit ``usage`` entirely.
        usage = getattr(response, "usage", None)
        if usage is None:
            return TokenUsage(0, 0, 0, self.name, self._model_name)
        return TokenUsage(
            prompt_tokens=usage.prompt_tokens,
            completion_tokens=usage.completion_tokens,
            total_tokens=usage.total_tokens,
            provider=self.name,
            model=self._model_name,
        )

    async def embed(self, texts: list[str]) -> list[list[float]]:
        vectors, _usage = await self.embed_with_usage(texts)
        return vectors

    async def embed_with_usage(self, texts: list[str]) -> tuple[list[list[float]], TokenUsage]:
        if not texts:
            return [], TokenUsage(0, 0, 0, self.name, self._model_name)
        try:
            response = await self._client.embeddings.create(
                model=self._model_name,
                input=texts,
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
            model=self._model_name,
        )
        return [item.embedding for item in response.data], usage
