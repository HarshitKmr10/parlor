"""Streaming PCM audio source.

Captures mono 16 kHz float32 audio from a chosen input device and yields it in
fixed-duration chunks. 16 kHz mono is what Whisper-family models expect, so we
resample/downmix at the boundary and keep the rest of the pipeline simple.

A ``mock`` source is provided too, so the full chunk -> STT -> POST pipeline is
runnable on a machine with no audio hardware (CI, headless boxes, demos).
"""

from __future__ import annotations

import queue
import time
from dataclasses import dataclass
from typing import Iterator, Optional

import numpy as np

from ..errors import AudioDeviceError
from .devices import AudioDevice, resolve_device

TARGET_SAMPLE_RATE = 16_000
DEFAULT_CHUNK_SECONDS = 5.0


@dataclass(frozen=True)
class AudioChunk:
    """A contiguous block of mono float32 PCM at :data:`TARGET_SAMPLE_RATE`."""

    samples: np.ndarray  # shape (n,), float32, range [-1, 1]
    sample_rate: int
    t_start_sec: float  # offset from capture start
    t_end_sec: float


class AudioSource:
    """Iterable that yields :class:`AudioChunk`s until stopped or duration hit."""

    def __init__(
        self,
        *,
        device_selector: Optional[str] = None,
        chunk_seconds: float = DEFAULT_CHUNK_SECONDS,
        duration_sec: Optional[float] = None,
        mock: bool = False,
    ) -> None:
        self._chunk_seconds = chunk_seconds
        self._duration_sec = duration_sec
        self._mock = mock
        self._stopped = False
        self._device: Optional[AudioDevice] = None
        self._used_fallback = False
        if not mock:
            self._device, self._used_fallback = resolve_device(device_selector)

    @property
    def device(self) -> Optional[AudioDevice]:
        return self._device

    @property
    def used_fallback(self) -> bool:
        return self._used_fallback

    @property
    def description(self) -> str:
        if self._mock:
            return "mock tone generator"
        assert self._device is not None
        return str(self._device)

    def stop(self) -> None:
        self._stopped = True

    def chunks(self) -> Iterator[AudioChunk]:
        if self._mock:
            yield from self._mock_chunks()
        else:
            yield from self._device_chunks()

    # ── mock source ─────────────────────────────────────────────────────
    def _mock_chunks(self) -> Iterator[AudioChunk]:
        frames = int(self._chunk_seconds * TARGET_SAMPLE_RATE)
        elapsed = 0.0
        while not self._stopped:
            if self._duration_sec is not None and elapsed >= self._duration_sec:
                return
            # Quiet noise so downstream code has real samples to chew on. The
            # mock STT backend ignores content and emits canned text.
            samples = (np.random.randn(frames) * 0.01).astype(np.float32)
            start = elapsed
            elapsed += self._chunk_seconds
            yield AudioChunk(
                samples=samples,
                sample_rate=TARGET_SAMPLE_RATE,
                t_start_sec=start,
                t_end_sec=elapsed,
            )
            # Pace the loop roughly in real time so `live` preview feels live.
            time.sleep(min(self._chunk_seconds, 0.5))

    # ── device source ───────────────────────────────────────────────────
    def _device_chunks(self) -> Iterator[AudioChunk]:
        try:
            import sounddevice as sd  # noqa: PLC0415
        except Exception as exc:  # noqa: BLE001
            raise AudioDeviceError(f"Audio backend unavailable: {exc}") from exc

        assert self._device is not None
        block_q: "queue.Queue[np.ndarray]" = queue.Queue()

        def _callback(indata, _frames, _time, status) -> None:  # pragma: no cover
            if status:
                # Overflows are non-fatal; the chunker just sees a gap.
                pass
            # Downmix to mono and copy out of the driver buffer.
            mono = indata.mean(axis=1) if indata.ndim > 1 else indata[:, 0]
            block_q.put(mono.astype(np.float32).copy())

        samples_per_chunk = int(self._chunk_seconds * TARGET_SAMPLE_RATE)
        buffer = np.zeros(0, dtype=np.float32)
        elapsed = 0.0
        try:
            stream = sd.InputStream(
                device=self._device.index,
                channels=min(self._device.max_input_channels, 2),
                samplerate=TARGET_SAMPLE_RATE,
                dtype="float32",
                callback=_callback,
                blocksize=0,
            )
        except Exception as exc:  # noqa: BLE001
            raise AudioDeviceError(
                f"Could not open input device '{self._device.name}': {exc}. "
                "Check microphone permissions in System Settings."
            ) from exc

        with stream:
            while not self._stopped:
                if self._duration_sec is not None and elapsed >= self._duration_sec:
                    break
                try:
                    block = block_q.get(timeout=1.0)
                except queue.Empty:
                    continue
                buffer = np.concatenate([buffer, block])
                while len(buffer) >= samples_per_chunk:
                    chunk_samples = buffer[:samples_per_chunk]
                    buffer = buffer[samples_per_chunk:]
                    start = elapsed
                    elapsed += self._chunk_seconds
                    yield AudioChunk(
                        samples=chunk_samples,
                        sample_rate=TARGET_SAMPLE_RATE,
                        t_start_sec=start,
                        t_end_sec=elapsed,
                    )
