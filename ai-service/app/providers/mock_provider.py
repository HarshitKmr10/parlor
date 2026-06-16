"""Deterministic mock provider for dev without API keys.

* ``complete_json`` returns a structured, schema-shaped summary derived from the
  prompt so the whole pipeline works offline.
* ``complete_text`` returns a plausible grounded answer.
* ``embed`` returns a deterministic hash-based pseudo-embedding of the configured
  dimension, so vector search behaves consistently across restarts.

The mock summarizer receives the original payload out-of-band via
``set_context`` because the textual prompt alone is lossy; the route layer sets
it before each call. This keeps the public provider interface identical to the
live providers.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
from typing import Any

from ..config import EMBEDDING_DIM
from .base import LLMProvider

_WORD_RE = re.compile(r"[A-Za-z][A-Za-z'-]+")


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

    def __init__(self) -> None:
        self._context: dict[str, Any] = {}

    def set_context(self, context: dict[str, Any]) -> None:
        """Provide the structured payload the mock summarizer needs."""
        self._context = context

    async def complete_json(
        self,
        *,
        system: str,
        user: str,
        schema: dict[str, Any],
        premium: bool = True,
        max_tokens: int = 8000,
    ) -> str:
        title = self._context.get("title", "Meeting")
        segments: list[dict[str, Any]] = self._context.get("segments", [])
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
    ) -> str:
        question = self._context.get("question", "")
        snippets: list[str] = self._context.get("snippets", [])
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
