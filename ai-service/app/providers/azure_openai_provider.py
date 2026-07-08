"""Azure OpenAI provider using the official ``openai`` SDK's ``AsyncAzureOpenAI``.

Azure routes by **deployment name**, not model id, so ``model=`` is set to the
configured deployment (``AZURE_OPENAI_DEPLOYMENT`` for premium chat calls,
``AZURE_OPENAI_CHEAP_DEPLOYMENT`` for cheap-tier calls -- falling back to the
premium deployment when the cheap one is unset). Structured output uses
``response_format`` with a JSON schema; chat uses a plain completion.

Notes on gpt-5.x deployments (e.g. ``gpt-5.4-mini``): these models reject the
legacy ``max_tokens`` parameter and require ``max_completion_tokens`` instead.
We send ``max_completion_tokens`` and, on the off chance a deployment is a
legacy gpt-4o-class model that only understands ``max_tokens``, we transparently
retry with the legacy parameter.

Embeddings use ``AZURE_OPENAI_EMBEDDING_DEPLOYMENT`` when configured. If no
embedding deployment exists, :meth:`embed` raises :class:`ProviderError` so the
router falls through to the next provider (ultimately the deterministic mock
embedder), keeping RAG functional without a hard failure.
"""

from __future__ import annotations

from typing import Any

import openai

from ..config import (
    AZURE_OPENAI_API_VERSION,
    AZURE_OPENAI_CHEAP_DEPLOYMENT,
    AZURE_OPENAI_DEPLOYMENT,
    AZURE_OPENAI_EMBEDDING_DEPLOYMENT,
    EMBEDDING_DIM,
    PROVIDER_TIMEOUT,
)
from .base import LLMProvider, ProviderError, TokenUsage


class AzureOpenAIProvider(LLMProvider):
    name = "azure"

    def __init__(
        self,
        *,
        endpoint: str,
        api_key: str,
        api_version: str = AZURE_OPENAI_API_VERSION,
        deployment: str = AZURE_OPENAI_DEPLOYMENT,
        cheap_deployment: str | None = AZURE_OPENAI_CHEAP_DEPLOYMENT,
        embedding_deployment: str | None = AZURE_OPENAI_EMBEDDING_DEPLOYMENT,
    ) -> None:
        self._client = openai.AsyncAzureOpenAI(
            azure_endpoint=endpoint,
            api_key=api_key,
            api_version=api_version,
            timeout=PROVIDER_TIMEOUT,
            max_retries=0,
        )
        # Azure routes by deployment name. ``cheap_deployment`` lets premium
        # and cheap calls target different deployments (mirroring the
        # Anthropic/OpenAI providers); when unset it falls back to reusing
        # the premium deployment for both tiers, preserving prior behavior.
        self._deployment = deployment
        self._cheap_deployment = cheap_deployment or deployment
        self._embedding_deployment = embedding_deployment or None

    def _model(self, premium: bool) -> str:
        return self._deployment if premium else self._cheap_deployment

    async def _create_chat(
        self,
        *,
        deployment: str,
        messages: list[dict[str, str]],
        max_tokens: int,
        response_format: dict[str, Any] | None = None,
    ):
        """Call chat completions, preferring ``max_completion_tokens``.

        gpt-5.x deployments require ``max_completion_tokens``; legacy gpt-4o
        deployments only accept ``max_tokens``. Try the modern parameter first
        and fall back to the legacy one if the API explicitly rejects it.
        """

        kwargs: dict[str, Any] = {"model": deployment, "messages": messages}
        if response_format is not None:
            kwargs["response_format"] = response_format

        try:
            return await self._client.chat.completions.create(
                max_completion_tokens=max_tokens, **kwargs
            )
        except openai.BadRequestError as exc:
            message = str(exc).lower()
            unsupported_modern = "max_completion_tokens" in message
            wants_legacy = "max_tokens" in message and "max_completion_tokens" not in message
            if unsupported_modern or wants_legacy:
                return await self._client.chat.completions.create(
                    max_tokens=max_tokens, **kwargs
                )
            raise

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
            response = await self._create_chat(
                deployment=self._model(premium),
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                max_tokens=max_tokens,
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
            response = await self._create_chat(
                deployment=self._model(premium),
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                max_tokens=max_tokens,
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
        # Azure routes by deployment name (``self._model(premium)``), which is
        # what we tag the usage with even though the pricing table in
        # ``pricing.py`` is keyed by underlying model id -- a deployment alias
        # will usually miss the table and estimate as ``None`` unless it
        # happens to match a known model name.
        #
        # ``usage`` is read defensively: the real Azure/OpenAI SDK always
        # populates it, but test doubles and some non-conformant
        # OpenAI-compatible backends may omit it entirely.
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
            return [], TokenUsage(0, 0, 0, self.name, self._embedding_deployment or "unknown")
        if not self._embedding_deployment:
            # No Azure embedding deployment configured; let the router fall
            # through to a provider that can embed (ultimately the mock embedder)
            # so RAG keeps working rather than hard-failing.
            raise ProviderError(
                self.name, "no Azure embedding deployment configured"
            )
        try:
            response = await self._client.embeddings.create(
                model=self._embedding_deployment,
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
            model=self._embedding_deployment,
        )
        return [item.embedding for item in response.data], usage
