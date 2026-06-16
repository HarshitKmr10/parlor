"""Mock STT backend — emits canned segments without any model.

Lets the full chunk -> segment -> POST pipeline run (and be tested) on any
machine, with no model download and no network. Alternates a fake speaker so
the diarization-shaped fields are exercised.
"""

from __future__ import annotations

import itertools

from ..audio.capture import AudioChunk
from .base import STTResult

_CANNED = (
    "Thanks everyone for joining the call today.",
    "Let's start with a quick status update.",
    "The desktop capture path is working end to end.",
    "We should follow up on the transcript ingestion next week.",
    "Action item: document the BlackHole setup steps.",
    "Any other questions before we wrap up?",
)
_SPEAKERS = ("You", "Them")


class MockSTT:
    name = "mock"

    def __init__(self) -> None:
        self._lines = itertools.cycle(_CANNED)
        self._speakers = itertools.cycle(_SPEAKERS)

    def transcribe(self, chunk: AudioChunk) -> list[STTResult]:
        return [
            STTResult(
                text=next(self._lines),
                t_start_sec=chunk.t_start_sec,
                t_end_sec=chunk.t_end_sec,
                speaker=next(self._speakers),
            )
        ]

    def close(self) -> None:
        return None
