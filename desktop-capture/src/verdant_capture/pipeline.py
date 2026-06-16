"""Capture pipeline: audio chunks -> STT -> segments -> backend + local file.

Coordinates the moving parts and reports progress through a small callback so
the CLI can render a live preview without the pipeline knowing about Rich.
"""

from __future__ import annotations

import json
import socket
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Optional

from .audio.capture import AudioSource
from .client.api import VerdantClient
from .client.segments import Segment, segment_from_stt
from .errors import BackendError
from .stt.base import STTBackend

SegmentCallback = Callable[[Segment], None]
StatusCallback = Callable[[str], None]


def synthetic_meeting_url() -> str:
    """A botless desktop:// URL identifying this capture session.

    Used for the local transcript record and documented as the botless source.
    Note: the public product API will reject this on create (platform unknown),
    so against a live backend you pass a real meeting URL instead.
    """
    host = socket.gethostname() or "localhost"
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    return f"desktop://{host}/{stamp}"


@dataclass
class CaptureResult:
    meeting_id: Optional[str]
    meeting_url: str
    segments: list[Segment] = field(default_factory=list)
    ingest_ok: bool = False
    transcript_path: Optional[Path] = None
    summary: Optional[dict] = None


class CapturePipeline:
    def __init__(
        self,
        *,
        source: AudioSource,
        stt: STTBackend,
        client: Optional[VerdantClient],
        default_speaker: str = "Speaker 1",
        on_segment: Optional[SegmentCallback] = None,
        on_status: Optional[StatusCallback] = None,
    ) -> None:
        self._source = source
        self._stt = stt
        self._client = client
        self._default_speaker = default_speaker
        self._on_segment = on_segment or (lambda _s: None)
        self._on_status = on_status or (lambda _m: None)

    def run(
        self,
        *,
        meeting_url: str,
        meeting_id: Optional[str],
        transcript_path: Optional[Path],
    ) -> CaptureResult:
        result = CaptureResult(
            meeting_id=meeting_id,
            meeting_url=meeting_url,
            transcript_path=transcript_path,
        )
        ingest_attempted = False
        ingest_unavailable = False

        try:
            for chunk in self._source.chunks():
                for stt_result in self._stt.transcribe(chunk):
                    segment = segment_from_stt(
                        stt_result, default_speaker=self._default_speaker
                    )
                    result.segments.append(segment)
                    self._on_segment(segment)
                    self._write_local(transcript_path, segment)

                    if (
                        self._client is not None
                        and meeting_id is not None
                        and not ingest_unavailable
                    ):
                        ingest_attempted = True
                        ok = self._try_ingest(meeting_id, segment)
                        if not ok:
                            ingest_unavailable = True
                            self._on_status(
                                "Backend has no transcript-ingest endpoint "
                                "(older build); keeping the local transcript "
                                "and will still drive /summarize on stop."
                            )
        except KeyboardInterrupt:
            self._on_status("Stopping (Ctrl-C)...")
            self._source.stop()

        result.ingest_ok = ingest_attempted and not ingest_unavailable
        return result

    def _try_ingest(self, meeting_id: str, segment: Segment) -> bool:
        # The public ingest endpoint takes a batch of contract TranscriptSegments.
        # We push each segment as it arrives (single-element batch) so the
        # backend transcript + live WS update in near-real-time.
        try:
            return self._client.post_segments(  # type: ignore[union-attr]
                meeting_id, [segment.to_contract()]
            )
        except BackendError as exc:
            # A transient connection error shouldn't kill the capture; report
            # once and stop trying to push (we still keep the local transcript).
            self._on_status(f"Segment upload failed: {exc}")
            return False

    @staticmethod
    def _write_local(path: Optional[Path], segment: Segment) -> None:
        if path is None:
            return
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(segment.to_contract()) + "\n")
