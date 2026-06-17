"""Azure OpenAI provider using the official ``openai`` SDK's ``AsyncAzureOpenAI``.

Azure routes by **deployment name**, not model id, so ``model=`` is set to the
configured deployment (``AZURE_OPENAI_DEPLOYMENT`` for chat). Structured output
uses ``response_format`` with a JSON schema; chat uses a plain completion.

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
    AZURE_OPENAI_DEPLOYMENT,
    AZURE_OPENAI_EMBEDDING_DEPLOYMENT,
    EMBEDDING_DIM,
    PROVIDER_TIMEOUT,
)
from .base import LLMProvider, ProviderError


class AzureOpenAIProvider(LLMProvider):
    name = "azure"

    def __init__(
        self,
        *,
        endpoint: str,
        api_key: str,
        api_version: str = AZURE_OPENAI_API_VERSION,
        deployment: str = AZURE_OPENAI_DEPLOYMENT,
        embedding_deployment: str | None = AZURE_OPENAI_EMBEDDING_DEPLOYMENT,
    ) -> None:
        self._client = openai.AsyncAzureOpenAI(
            azure_endpoint=endpoint,
            api_key=api_key,
            api_version=api_version,
            timeout=PROVIDER_TIMEOUT,
        )
        # Azure routes by deployment name; a single chat deployment is used for
        # both premium and cheap tiers (the resource's "mini" deployment is the
        # configured default and is already economical).
        self._deployment = deployment
        self._embedding_deployment = embedding_deployment or None

    def _model(self, premium: bool) -> str:  # noqa: ARG002 - parity with siblings
        return self._deployment

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
    ) -> str:
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
        return content

    async def complete_text(
        self,
        *,
        system: str,
        user: str,
        premium: bool = True,
        max_tokens: int = 2000,
    ) -> str:
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
        return content

    async def embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
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

        return [item.embedding for item in response.data]
