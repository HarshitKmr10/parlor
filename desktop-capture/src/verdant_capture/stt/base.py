"""STT backend protocol and result type."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol, runtime_checkable

from ..audio.capture import AudioChunk


@dataclass(frozen=True)
class STTResult:
    """A transcribed span within a chunk.

    Times are absolute offsets from capture start (the backend adds the chunk's
    ``t_start_sec`` to model-relative times). ``speaker`` is best-effort — most
    local backends do not diarize, so callers default it (e.g. "You"/"Them").
    """

    text: str
    t_start_sec: float
    t_end_sec: float
    speaker: str | None = None


@runtime_checkable
class STTBackend(Protocol):
    """Turn audio chunks into transcript spans.

    Implementations should be cheap to construct but may lazily load heavy
    models on first :meth:`transcribe`. They must never raise on empty/quiet
    audio — return an empty list instead.
    """

    name: str

    def transcribe(self, chunk: AudioChunk) -> list[STTResult]:
        """Transcribe a single chunk. Returns ``[]`` when nothing was heard."""
        ...

    def close(self) -> None:
        """Release any model/network resources. Safe to call more than once."""
        ...
