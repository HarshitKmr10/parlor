"""Remote HTTP STT backend (stub).

POSTs a chunk's PCM as a 16-bit WAV to a configurable transcription endpoint
and expects a JSON body of ``{"segments": [{"text", "start", "end",
"speaker"?}]}``. This is a stub to keep STT pluggable — adapt the request/parse
shape to whatever STT service you point it at (e.g. a Whisper HTTP server).
"""

from __future__ import annotations

import io
import struct
import wave
from typing import Optional

import httpx
import numpy as np

from ..audio.capture import AudioChunk
from ..errors import STTError
from .base import STTResult

_HTTP_TIMEOUT = 30.0


def _pcm16_wav_bytes(samples: np.ndarray, sample_rate: int) -> bytes:
    clipped = np.clip(samples, -1.0, 1.0)
    pcm16 = (clipped * 32767.0).astype("<i2")
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        wav.writeframes(pcm16.tobytes())
    return buf.getvalue()


class RemoteSTT:
    name = "remote"

    def __init__(self, *, endpoint: str, api_key: Optional[str] = None) -> None:
        self._endpoint = endpoint
        headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
        self._client = httpx.Client(timeout=_HTTP_TIMEOUT, headers=headers)

    def transcribe(self, chunk: AudioChunk) -> list[STTResult]:
        wav_bytes = _pcm16_wav_bytes(chunk.samples, chunk.sample_rate)
        try:
            resp = self._client.post(
                self._endpoint,
                files={"audio": ("chunk.wav", wav_bytes, "audio/wav")},
            )
            resp.raise_for_status()
            data = resp.json()
        except httpx.HTTPError as exc:
            raise STTError(f"Remote STT request failed: {exc}") from exc

        results: list[STTResult] = []
        for seg in data.get("segments", []):
            text = str(seg.get("text", "")).strip()
            if not text:
                continue
            start = float(seg.get("start", 0.0))
            end = float(seg.get("end", start))
            results.append(
                STTResult(
                    text=text,
                    t_start_sec=chunk.t_start_sec + start,
                    t_end_sec=chunk.t_start_sec + end,
                    speaker=seg.get("speaker"),
                )
            )
        return results

    def close(self) -> None:
        self._client.close()


# Keep struct imported for adapters that need raw PCM framing; silences linters
# while documenting that WAV is one of several encodings callers may swap in.
_ = struct
