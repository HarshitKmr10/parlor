"""Deterministic mock provider for dev without API keys.

* ``complete_json`` returns a structured, schema-shaped summary derived from the
  prompt so the whole pipeline works offline.
* ``complete_text`` returns a plausible grounded answer.
* ``embed`` returns a deterministic hash-based pseudo-embedding of the configured
  dimension, so vector search behaves consistently across restarts.

The mock summarizer receives the original payload out-of-band via a
``mock_context`` keyword argument because the textual prompt alone is lossy.
It is passed per-call rather than stored on the instance: :class:`MockProvider`
is a shared singleton (via ``ProviderRouter``), so mutating instance state from
one request could leak into a concurrent request's response. This keeps the
public provider interface identical to the live providers, which also ignore
``mock_context``.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
from typing import Any

from ..config import EMBEDDING_DIM
from .base import LLMProvider, TokenUsage

_WORD_RE = re.compile(r"[A-Za-z][A-Za-z'-]+")

_MOCK_MODEL_NAME = "mock-model"


def _estimate_tokens(text: str) -> int:
    """Deterministic, proportional token estimate for the mock provider.

    No real tokenizer is invoked (mock mode never calls out to an LLM); this
    is a rough ~4-chars-per-token approximation, consistent with the same
    assumption already used for chunk sizing (see ``MAX_CHARS_PER_CHUNK``),
    just so usage numbers look plausible and scale with input size in dev.
    """

    return max(1, len(text) // 4)


def hash_embedding(text: str, dim: int = EMBEDDING_DIM) -> list[float]:
    """Deterministic unit-norm pseudo-embedding from token hashes.

    Each token contributes to a bucket chosen by its hash; the resulting vector
    is L2-normalized so cosine similarity is meaningful. Shared vocabulary
    between two texts yields higher similarity, which makes mock RAG plausible.
    """

    vec = [0.0] * dim
    tokens = _WORD_RE.findall(text.lower()) or [text.lower()]
    for token in tokens:
        digest = hashlib.sha256(token.encode("utf-8")).digest()
        idx = int.from_bytes(digest[:4], "big") % dim
        sign = 1.0 if digest[4] & 1 else -1.0
        vec[idx] += sign
    norm = math.sqrt(sum(v * v for v in vec))
    if norm == 0.0:
        return vec
    return [v / norm for v in vec]


class MockProvider(LLMProvider):
    name = "mock"

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
        context = mock_context or {}
        title = context.get("title", "Meeting")
        segments: list[dict[str, Any]] = context.get("segments", [])
        speakers = sorted({s.get("speakerName", "") for s in segments if s.get("speakerName")})

        first_texts = [s.get("text", "") for s in segments[:3] if s.get("text")]
        summary = (
            f"[mock] Discussion titled '{title}' across {len(segments)} "
            f"segment(s) involving {', '.join(speakers) or 'participants'}. "
            + (" ".join(first_texts)[:280] if first_texts else "")
        ).strip()

        key_points = [
            (s.get("text", "")[:120]).strip()
            for s in segments[:5]
            if s.get("text")
        ] or ["[mock] No transcript content provided."]

        # Action items: pick segments whose text hints at a follow-up.
        action_items = []
        for s in segments:
            text = s.get("text", "")
            if re.search(r"\b(will|need to|action|todo|follow up|let's|by next)\b", text, re.I):
                action_items.append(
                    {
                        "text": text[:160].strip(),
                        "assignee": s.get("speakerName"),
                        "done": False,
                    }
                )
        if not action_items and segments:
            action_items.append(
                {"text": "[mock] Review meeting notes.", "assignee": None, "done": False}
            )

        # Chapters: bucket the timeline into up to 3 chapters.
        chapters = []
        if segments:
            n = len(segments)
            buckets = min(3, n)
            size = math.ceil(n / buckets)
            for i in range(buckets):
                chunk = segments[i * size : (i + 1) * size]
                if not chunk:
                    continue
                chapters.append(
                    {
                        "title": f"[mock] Part {i + 1}: "
                        + (chunk[0].get("text", "")[:50]).strip(),
                        "tStartSec": chunk[0].get("tStartSec", 0.0),
                        "tEndSec": chunk[-1].get("tEndSec")
                        or chunk[-1].get("tStartSec", 0.0),
                    }
                )

        return json.dumps(
            {
                "summary": summary,
                "keyPoints": key_points,
                "actionItems": action_items,
                "chapters": chapters,
            }
        )

    async def complete_text(
        self,
        *,
        system: str,
        user: str,
        premium: bool = True,
        max_tokens: int = 2000,
        mock_context: dict[str, Any] | None = None,
    ) -> str:
        context = mock_context or {}
        question = context.get("question", "")
        snippets: list[str] = context.get("snippets", [])
        if snippets:
            joined = " ".join(snippets[:3])
            return (
                f"[mock] Based on the meeting transcript, regarding "
                f"\"{question}\": {joined[:400]}".strip()
            )
        return (
            f"[mock] I could not find relevant transcript content to answer "
            f"\"{question}\"."
        )

    async def embed(self, texts: list[str]) -> list[list[float]]:
        return [hash_embedding(t) for t in texts]

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
        prompt_tokens = _estimate_tokens(system + user)
        completion_tokens = _estimate_tokens(content)
        usage = TokenUsage(
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=prompt_tokens + completion_tokens,
            provider=self.name,
            model=_MOCK_MODEL_NAME,
        )
        return content, usage

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
        prompt_tokens = _estimate_tokens(system + user)
        completion_tokens = _estimate_tokens(content)
        usage = TokenUsage(
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=prompt_tokens + completion_tokens,
            provider=self.name,
            model=_MOCK_MODEL_NAME,
        )
        return content, usage

    async def embed_with_usage(self, texts: list[str]) -> tuple[list[list[float]], TokenUsage]:
        vectors = await self.embed(texts)
        prompt_tokens = _estimate_tokens("".join(texts))
        usage = TokenUsage(
            prompt_tokens=prompt_tokens,
            completion_tokens=0,
            total_tokens=prompt_tokens,
            provider=self.name,
            model=_MOCK_MODEL_NAME,
        )
        return vectors, usage
