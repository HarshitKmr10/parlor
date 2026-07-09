"""Google Gemini provider using the official ``google-genai`` SDK.

This is the current, actively-maintained Google Gen AI Python SDK (package
``google-genai``, imported as ``google.genai``) -- **not** the deprecated
``google-generativeai`` package, which is a legacy client for the same API.

Structured output is obtained via ``response_mime_type="application/json"``
plus ``response_json_schema`` -- the SDK accepts a standard JSON schema dict
directly (``GenerateContentConfig.response_json_schema``), so no tool-use
workaround (as in :mod:`app.providers.anthropic_provider`) is needed.
Embeddings use ``gemini-embedding-001``, truncated to ``EMBEDDING_DIM`` via
``output_dimensionality`` so the pgvector column width stays identical across
providers.
"""

from __future__ import annotations

from typing import Any

from google import genai
from google.genai import errors as genai_errors
from google.genai import types as genai_types

from ..config import (
    EMBEDDING_DIM,
    GEMINI_CHEAP_MODEL,
    GEMINI_EMBEDDING_MODEL,
    GEMINI_PREMIUM_MODEL,
    PROVIDER_TIMEOUT,
)
from .base import LLMProvider, ProviderError, TokenUsage


class GeminiProvider(LLMProvider):
    name = "gemini"

    def __init__(
        self,
        api_key: str,
        *,
        premium_model: str = GEMINI_PREMIUM_MODEL,
        cheap_model: str = GEMINI_CHEAP_MODEL,
    ) -> None:
        self._client = genai.Client(
            api_key=api_key,
            http_options=genai_types.HttpOptions(
                timeout=int(PROVIDER_TIMEOUT * 1000),
                # attempts=1 means "no retries" per the SDK's own docstring
                # (0 or 1 both mean no retries) -- matches the other SDK
                # clients' max_retries=0, so a hanging/erroring call doesn't
                # silently burn the router's own REQUEST_TIME_BUDGET on
                # retries the router itself already handles via fallback.
                retry_options=genai_types.HttpRetryOptions(attempts=1),
            ),
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
            response = await self._client.aio.models.generate_content(
                model=self._model(premium),
                contents=user,
                config=genai_types.GenerateContentConfig(
                    system_instruction=system,
                    max_output_tokens=max_tokens,
                    response_mime_type="application/json",
                    response_json_schema=schema,
                ),
            )
        except genai_errors.APIError as exc:
            raise ProviderError(self.name, str(exc)) from exc
        except Exception as exc:
            raise ProviderError(self.name, str(exc)) from exc

        content = response.text
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
            response = await self._client.aio.models.generate_content(
                model=self._model(premium),
                contents=user,
                config=genai_types.GenerateContentConfig(
                    system_instruction=system,
                    max_output_tokens=max_tokens,
                ),
            )
        except genai_errors.APIError as exc:
            raise ProviderError(self.name, str(exc)) from exc
        except Exception as exc:
            raise ProviderError(self.name, str(exc)) from exc

        content = response.text
        if not content:
            raise ProviderError(self.name, "empty completion content")
        return content, self._usage_from_response(response, premium)

    def _usage_from_response(self, response: Any, premium: bool) -> TokenUsage:
        # Read defensively: the real SDK always populates ``usage_metadata``,
        # but test doubles may omit it.
        usage = getattr(response, "usage_metadata", None)
        if usage is None:
            return TokenUsage(0, 0, 0, self.name, self._model(premium))
        prompt_tokens = usage.prompt_token_count or 0
        completion_tokens = usage.candidates_token_count or 0
        total_tokens = usage.total_token_count or (prompt_tokens + completion_tokens)
        return TokenUsage(
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            provider=self.name,
            model=self._model(premium),
        )

    async def embed(self, texts: list[str]) -> list[list[float]]:
        vectors, _usage = await self.embed_with_usage(texts)
        return vectors

    async def embed_with_usage(self, texts: list[str]) -> tuple[list[list[float]], TokenUsage]:
        if not texts:
            return [], TokenUsage(0, 0, 0, self.name, GEMINI_EMBEDDING_MODEL)
        try:
            response = await self._client.aio.models.embed_content(
                model=GEMINI_EMBEDDING_MODEL,
                contents=texts,
                config=genai_types.EmbedContentConfig(
                    output_dimensionality=EMBEDDING_DIM
                ),
            )
        except genai_errors.APIError as exc:
            raise ProviderError(self.name, str(exc)) from exc
        except Exception as exc:
            raise ProviderError(self.name, str(exc)) from exc

        embeddings = response.embeddings or []
        if len(embeddings) != len(texts):
            raise ProviderError(
                self.name,
                f"expected {len(texts)} embeddings, got {len(embeddings)}",
            )

        # The Gemini Developer API (unlike Vertex/Enterprise) doesn't surface
        # an aggregate token count on EmbedContentResponse -- only per-item
        # ``statistics.token_count``, which itself is documented as an
        # Enterprise-only field. Sum defensively so this degrades to 0 (like
        # the base class's zero-valued default) rather than raising when
        # absent.
        token_total = 0
        for item in embeddings:
            stats = getattr(item, "statistics", None)
            token_count = getattr(stats, "token_count", None) if stats else None
            if token_count:
                token_total += int(token_count)

        usage = TokenUsage(token_total, 0, token_total, self.name, GEMINI_EMBEDDING_MODEL)
        return [item.values for item in embeddings], usage
