"""Local offline STT via faster-whisper (optional ``[whisper]`` extra).

faster-whisper (ctranslate2) runs Whisper models locally on CPU or GPU. The
model is downloaded on first use and cached. We feed it the raw float32 mono
samples directly — no temp WAV files. This backend does NOT diarize; callers
assign a default speaker label.
"""

from __future__ import annotations

from ..audio.capture import AudioChunk
from ..errors import STTError
from .base import STTResult


class FasterWhisperSTT:
    name = "faster-whisper"

    def __init__(
        self,
        *,
        model_size: str = "base",
        compute_type: str = "int8",
        device: str = "cpu",
        language: str | None = None,
    ) -> None:
        self._model_size = model_size
        self._compute_type = compute_type
        self._device = device
        self._language = language
        self._model = None  # lazily loaded on first transcribe

    def _ensure_model(self):
        if self._model is not None:
            return self._model
        try:
            from faster_whisper import WhisperModel  # noqa: PLC0415
        except ImportError as exc:
            raise STTError(
                "faster-whisper is not installed. Install the optional extra: "
                "`pip install -e '.[whisper]'`, or use `--stt mock` for a "
                "model-free demo."
            ) from exc
        try:
            self._model = WhisperModel(
                self._model_size,
                device=self._device,
                compute_type=self._compute_type,
            )
        except Exception as exc:  # noqa: BLE001 — model download / runtime issues
            raise STTError(
                f"Could not load faster-whisper model '{self._model_size}': {exc}"
            ) from exc
        return self._model

    def transcribe(self, chunk: AudioChunk) -> list[STTResult]:
        model = self._ensure_model()
        try:
            segments, _info = model.transcribe(
                chunk.samples,
                language=self._language,
                vad_filter=True,
                beam_size=1,
            )
        except Exception as exc:  # noqa: BLE001
            raise STTError(f"faster-whisper transcription failed: {exc}") from exc

        results: list[STTResult] = []
        for seg in segments:
            text = (seg.text or "").strip()
            if not text:
                continue
            results.append(
                STTResult(
                    text=text,
                    t_start_sec=chunk.t_start_sec + float(seg.start),
                    t_end_sec=chunk.t_start_sec + float(seg.end),
                    speaker=None,
                )
            )
        return results

    def close(self) -> None:
        self._model = None
