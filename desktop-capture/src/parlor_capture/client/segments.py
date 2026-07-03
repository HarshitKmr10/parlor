"""Transcript segment shaping.

Two shapes matter:

1. The public contract's ``TranscriptSegment`` (camelCase: ``speakerName``,
   ``tStartSec`` ...), used for read paths and the ``/summarize`` payload.
2. The internal ``meeting_joiner`` transcript ``content`` item shape
   (``{speaker, text, startTime, endTime, timestamp}``) that the backend's
   ``append_transcript_segment`` consumes. We emit *both* so the client works
   against whichever ingest the backend exposes.

See backend/src/api/product/mappers.py::segments_from_transcript for how the
backend projects internal content items back into contract segments.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

from ..stt.base import STTResult


@dataclass(frozen=True)
class Segment:
    id: str
    speaker_name: str
    text: str
    t_start_sec: float
    t_end_sec: float
    created_at: str  # ISO-8601 UTC

    def to_contract(self) -> dict:
        """camelCase shape matching the public ``TranscriptSegment``."""
        return {
            "id": self.id,
            "speakerId": None,
            "speakerName": self.speaker_name,
            "text": self.text,
            "tStartSec": self.t_start_sec,
            "tEndSec": self.t_end_sec,
            "createdAt": self.created_at,
        }

    def to_internal_content_item(self) -> dict:
        """Shape consumed by the internal transcript ``content`` list."""
        return {
            "id": self.id,
            "speaker": self.speaker_name,
            "text": self.text,
            "startTime": self.t_start_sec,
            "endTime": self.t_end_sec,
            "timestamp": self.created_at,
        }


def segment_from_stt(result: STTResult, *, default_speaker: str = "Speaker 1") -> Segment:
    return Segment(
        id=str(uuid.uuid4()),
        speaker_name=result.speaker or default_speaker,
        text=result.text,
        t_start_sec=result.t_start_sec,
        t_end_sec=result.t_end_sec,
        created_at=datetime.now(timezone.utc).isoformat(),
    )
