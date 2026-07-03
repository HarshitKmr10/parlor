"""Pluggable speech-to-text backends.

The :class:`STTBackend` protocol is the seam: implementations turn an
:class:`~verdant_capture.audio.capture.AudioChunk` into zero or more
:class:`STTResult` pieces. Pick one with :func:`build_backend`.

Backends:
- ``mock``  — canned segments, no model, always available (default for demos/CI).
- ``faster-whisper`` — local offline transcription (optional ``[whisper]`` extra).
- ``remote`` — POSTs audio to a configurable HTTP STT endpoint.
"""

from __future__ import annotations

from typing import Optional

from ..errors import STTError
from .base import STTBackend, STTResult

__all__ = ["STTBackend", "STTResult", "build_backend"]


def build_backend(name: str, **kwargs) -> STTBackend:
    """Factory for STT backends. Raises :class:`STTError` for unknown names."""
    name = (name or "mock").lower()
    if name == "mock":
        from .mock import MockSTT  # noqa: PLC0415

        return MockSTT()
    if name in ("faster-whisper", "whisper", "faster_whisper"):
        from .faster_whisper_backend import FasterWhisperSTT  # noqa: PLC0415

        model = kwargs.get("model") or "base"
        return FasterWhisperSTT(model_size=model)
    if name == "remote":
        from .remote import RemoteSTT  # noqa: PLC0415

        endpoint: Optional[str] = kwargs.get("endpoint")
        if not endpoint:
            raise STTError("remote STT backend requires --stt-endpoint")
        return RemoteSTT(endpoint=endpoint, api_key=kwargs.get("api_key"))
    raise STTError(
        f"Unknown STT backend '{name}'. Choose: mock, faster-whisper, remote."
    )
