"""Capture pipeline: audio chunks -> STT -> segments -> backend + local file.

Coordinates the moving parts and reports progress through a small callback so
the CLI can render a live preview without the pipeline knowing about Rich.
"""

from __future__ import annotations

import json
import socket
import time
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

# Retry-with-backoff for transient (connection-level) ingest failures. Kept
# small: capture is a live, real-time loop and shouldn't stall long per
# segment. Permanent failures (404/405 - old backend build) never retry.
_TRANSIENT_RETRY_ATTEMPTS = 3
_TRANSIENT_RETRY_BASE_DELAY_SEC = 0.5


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
        ingest_unavailable = False  # permanent: 404/405, old backend build
        backlog: list[Segment] = []  # segments not yet confirmed ingested

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
                        outcome = self._try_ingest(meeting_id, segment)
                        if outcome is None:
                            ingest_unavailable = True
                            backlog.clear()
                            self._on_status(
                                "Backend has no transcript-ingest endpoint "
                                "(older build); keeping the local transcript "
                                "and will still drive /summarize on stop."
                            )
                        elif outcome is False:
                            backlog.append(segment)
                        else:
                            if backlog and self._replay_backlog(
                                meeting_id, backlog
                            ):
                                ingest_unavailable = True
        except KeyboardInterrupt:
            self._on_status("Stopping (Ctrl-C)...")
            self._source.stop()

        result.ingest_ok = (
            ingest_attempted and not ingest_unavailable and not backlog
        )
        return result

    def _try_ingest(self, meeting_id: str, segment: Segment) -> Optional[bool]:
        """Push one segment to the backend ingest endpoint.

        Returns ``True`` on success, ``False`` on a transient (connection or
        server) failure that may recover, and ``None`` when the backend has
        no ingest endpoint at all (404/405 - permanent for this run).
        """
        for attempt in range(1, _TRANSIENT_RETRY_ATTEMPTS + 1):
            try:
                ok = self._client.post_segments(  # type: ignore[union-attr]
                    meeting_id, [segment.to_contract()]
                )
            except BackendError as exc:
                if attempt < _TRANSIENT_RETRY_ATTEMPTS:
                    time.sleep(_TRANSIENT_RETRY_BASE_DELAY_SEC * attempt)
                    continue
                self._on_status(
                    f"Segment upload failed (will keep retrying): {exc}"
                )
                return False
            if not ok:
                return None
            return True
        return False  # pragma: no cover - loop always returns above

    def _replay_backlog(self, meeting_id: str, backlog: list[Segment]) -> bool:
        """Resend segments accumulated during a transient outage, in order.

        Every item in ``pending`` gets an attempt this pass, even after an
        earlier item fails again: a still-transient failure re-queues just
        that segment (not the whole tail) and keeps going, so a later
        segment that would have succeeded is never silently discarded.

        Interruption safety: ``pending`` is only ever popped *after* an
        item's outcome is known, and the ``finally`` block re-queues
        whatever is still sitting in ``pending`` (the in-flight segment
        plus every one behind it) into ``backlog``. That means a
        ``KeyboardInterrupt`` (or any other exception) raised out of
        ``_try_ingest`` mid-pass - e.g. during the retry backoff sleep -
        can never silently drop a segment: it either already made it into
        ``backlog`` via the normal re-queue path below, or it's still in
        ``pending`` and the ``finally`` catches it.

        Returns ``True`` when a permanent (404/405) failure was discovered
        during this replay pass. Callers must treat that the same as a
        permanent failure discovered on the main loop's own direct
        ``_try_ingest`` call: propagate it into ``ingest_unavailable`` so a
        run that permanently lost segments mid-replay never reports
        ``ingest_ok`` as ``True``.
        """
        pending = list(backlog)
        backlog.clear()
        went_permanent = False
        replayed = 0
        try:
            while pending:
                if went_permanent:
                    # Ingest just went permanently unavailable mid-replay:
                    # further backend calls would only repeat the same
                    # 404/405, so stop attempting them. These segments are
                    # intentionally not re-queued (a permanent failure will
                    # never succeed on retry), matching the main loop's
                    # ``backlog.clear()`` when ``_try_ingest`` first returns
                    # ``None``.
                    pending.clear()
                    break
                segment = pending[0]
                outcome = self._try_ingest(meeting_id, segment)
                # Only pop once the outcome is known - if `_try_ingest`
                # raises, `segment` stays at the front of `pending` for the
                # `finally` block to recover.
                pending.pop(0)
                if outcome is True:
                    replayed += 1
                    continue
                if outcome is None:
                    # Permanent as of this segment: stop calling the
                    # backend for the rest of ``pending`` (handled by the
                    # guard above) and don't re-queue this one either.
                    went_permanent = True
                    continue
                # Still a transient failure: re-queue only this segment and
                # keep attempting the rest of ``pending``.
                backlog.append(segment)
        finally:
            # Any exception unwinding through the loop above (including
            # KeyboardInterrupt) leaves `pending` holding exactly the
            # segments that were neither replayed, permanently dropped, nor
            # already re-queued - put them back so nothing is lost.
            backlog.extend(pending)
        if replayed:
            self._on_status(
                f"Backend reconnected; replayed {replayed} queued segment(s)."
            )
        return went_permanent

    @staticmethod
    def _write_local(path: Optional[Path], segment: Segment) -> None:
        if path is None:
            return
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(segment.to_contract()) + "\n")
