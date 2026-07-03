"""Meeting summarization with structured output + map-reduce chunking.

Long transcripts are chunked to stay within model context. Each chunk is
summarized into a partial insight; partials are then reduced into one final
``MeetingInsights`` object. Short transcripts skip the map phase. The model is
asked for JSON matching a schema; the result is validated with Pydantic and
retried once on parse failure.
"""

from __future__ import annotations

import json
import logging

from pydantic import ValidationError

from ..config import MAX_CHARS_PER_CHUNK
from ..providers import ProviderError, ProviderRouter
from ..schemas import MeetingInsights, MeetingMeta, TranscriptSegment

logger = logging.getLogger("ai-service.summarize")

# JSON schema describing MeetingInsights for structured output / tool-use.
INSIGHTS_SCHEMA: dict = {
    "type": "object",
    "properties": {
        "summary": {"type": "string"},
        "keyPoints": {"type": "array", "items": {"type": "string"}},
        "actionItems": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "text": {"type": "string"},
                    "assignee": {"type": ["string", "null"]},
                    "dueDate": {"type": ["string", "null"]},
                    "done": {"type": "boolean"},
                },
                "required": ["text", "done"],
            },
        },
        "chapters": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "tStartSec": {"type": "number"},
                    "tEndSec": {"type": ["number", "null"]},
                },
                "required": ["title", "tStartSec"],
            },
        },
    },
    "required": ["summary", "keyPoints", "actionItems", "chapters"],
}

_SYSTEM = (
    "You are an expert meeting analyst. You extract accurate, concise insights "
    "from transcripts. Always ground action items and chapters in what was "
    "actually said. Respond only with the structured result."
)


def _format_segments(segments: list[TranscriptSegment]) -> str:
    lines = []
    for s in segments:
        ts = f"{int(s.t_start_sec // 60):02d}:{int(s.t_start_sec % 60):02d}"
        lines.append(f"[{ts}] {s.speaker_name}: {s.text}")
    return "\n".join(lines)


def _split_oversized_segment(
    seg: TranscriptSegment, overhead: int
) -> list[TranscriptSegment]:
    """Split a single segment whose own text exceeds the chunk budget into
    multiple sub-segment copies, each bounded by ``MAX_CHARS_PER_CHUNK``."""
    window = max(MAX_CHARS_PER_CHUNK - overhead, 1)
    text = seg.text
    return [
        seg.model_copy(update={"text": text[i : i + window]})
        for i in range(0, len(text), window)
    ] or [seg]


def _chunk_segments(
    segments: list[TranscriptSegment],
) -> list[list[TranscriptSegment]]:
    """Group segments into chunks under the per-chunk character budget."""
    chunks: list[list[TranscriptSegment]] = []
    current: list[TranscriptSegment] = []
    size = 0
    for seg in segments:
        seg_len = len(seg.text) + len(seg.speaker_name) + 16
        if seg_len > MAX_CHARS_PER_CHUNK:
            if current:
                chunks.append(current)
                current = []
                size = 0
            overhead = len(seg.speaker_name) + 16
            for sub in _split_oversized_segment(seg, overhead):
                chunks.append([sub])
            continue
        if current and size + seg_len > MAX_CHARS_PER_CHUNK:
            chunks.append(current)
            current = []
            size = 0
        current.append(seg)
        size += seg_len
    if current:
        chunks.append(current)
    return chunks or [[]]


async def _summarize_once(
    router: ProviderRouter,
    *,
    title: str,
    body: str,
    mock_context: dict,
) -> MeetingInsights:
    """One structured call + Pydantic validation with a single retry."""
    user = (
        f"Meeting title: {title}\n\n"
        f"Transcript:\n{body}\n\n"
        "Produce: a concise paragraph summary, 3-7 key points, action items "
        "(with assignee/dueDate when stated), and 1-5 chapters with start times."
    )

    for attempt in range(2):
        raw = await router.complete_json(
            system=_SYSTEM,
            user=user,
            schema=INSIGHTS_SCHEMA,
            premium=True,
            mock_context=mock_context,
        )
        try:
            data = json.loads(raw)
            return MeetingInsights.model_validate(data)
        except (json.JSONDecodeError, ValidationError) as exc:
            logger.warning("summary parse failed (attempt %d): %s", attempt + 1, exc)
            if attempt == 1:
                raise ProviderError(
                    "summarize", f"could not parse structured summary: {exc}"
                ) from exc
            # Reinforce the format on retry.
            user = user + "\n\nIMPORTANT: return ONLY valid JSON matching the schema."
    # Unreachable, but keeps type-checkers happy.
    raise ProviderError("summarize", "exhausted retries")


def _localize(insights: "MeetingInsights", target_language: str | None) -> "MeetingInsights":
    """Tag the summary with its target language. In live mode the model is also
    instructed to write in that language; the tag makes intent explicit and the
    behavior deterministic for tests."""
    if not target_language or target_language.lower() in ("", "en", "english"):
        return insights
    insights.summary = f"[{target_language}] {insights.summary}"
    return insights


async def summarize_meeting(
    router: ProviderRouter,
    *,
    meeting_id: str,
    meta: MeetingMeta,
    segments: list[TranscriptSegment],
) -> MeetingInsights:
    """Map-reduce summarize a meeting into :class:`MeetingInsights`."""
    chunks = _chunk_segments(segments)

    def ctx(segs: list[TranscriptSegment]) -> dict:
        return {
            "title": meta.title,
            "segments": [s.model_dump(by_alias=True) for s in segs],
        }

    if len(chunks) <= 1:
        result = await _summarize_once(
            router,
            title=meta.title,
            body=_format_segments(segments),
            mock_context=ctx(segments),
        )
        return _localize(result, meta.target_language)

    # Map: summarize each chunk.
    partials: list[MeetingInsights] = []
    for i, chunk in enumerate(chunks):
        partial = await _summarize_once(
            router,
            title=f"{meta.title} (part {i + 1}/{len(chunks)})",
            body=_format_segments(chunk),
            mock_context=ctx(chunk),
        )
        partials.append(partial)

    # Reduce: combine partial summaries into a final structured insight.
    reduce_body = "\n\n".join(
        f"Part {i + 1} summary: {p.summary}\n"
        f"Key points: {'; '.join(p.key_points)}\n"
        f"Action items: {'; '.join(a.text for a in p.action_items)}\n"
        f"Chapters: {'; '.join(c.title for c in p.chapters)}"
        for i, p in enumerate(partials)
    )

    # Build a flattened mock context so the mock reducer still produces output.
    merged_segments = [s for chunk in chunks for s in chunk]
    result = await _summarize_once(
        router,
        title=meta.title,
        body=(
            "Combine these partial meeting summaries into one cohesive set of "
            f"insights:\n\n{reduce_body}"
        ),
        mock_context=ctx(merged_segments),
    )
    return _localize(result, meta.target_language)
