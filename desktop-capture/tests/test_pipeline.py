"""Pipeline smoke tests using the mock audio source + mock STT.

These prove the chunk -> segment -> (optional POST) flow end to end without
audio hardware, a model, or a live backend.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest

from verdant_capture.audio.capture import AudioSource
from verdant_capture.client.segments import Segment, segment_from_stt
from verdant_capture.errors import BackendError
from verdant_capture.pipeline import CapturePipeline, synthetic_meeting_url
from verdant_capture.stt import build_backend
from verdant_capture.stt.base import STTResult


class FakeIngestClient:
    """Duck-typed stand-in for ``VerdantClient.post_segments``.

    ``outcomes`` is consumed one entry per call to decide how that call
    behaves: ``True``/``False`` returns directly (mirroring the real
    client's permanent-404/405-vs-success return value), and an
    ``Exception`` instance is raised (mirroring a transient
    :class:`BackendError`). Once exhausted, the last outcome repeats.
    """

    def __init__(self, outcomes: list[Any]) -> None:
        self._outcomes = list(outcomes)
        self._last: Any = True
        self.calls: list[list[dict]] = []

    def post_segments(self, meeting_id: str, segments: list[dict]) -> bool:
        self.calls.append(segments)
        outcome = self._outcomes.pop(0) if self._outcomes else self._last
        self._last = outcome
        if isinstance(outcome, Exception):
            raise outcome
        return outcome


def test_segment_shapes_match_contract() -> None:
    seg = segment_from_stt(
        STTResult(text="hello", t_start_sec=1.0, t_end_sec=2.0, speaker="You")
    )
    contract = seg.to_contract()
    assert contract["speakerName"] == "You"
    assert contract["tStartSec"] == 1.0
    assert contract["tEndSec"] == 2.0
    internal = seg.to_internal_content_item()
    assert internal["speaker"] == "You"
    assert internal["startTime"] == 1.0


def test_pipeline_local_mode_writes_transcript(tmp_path: Path) -> None:
    source = AudioSource(chunk_seconds=1.0, duration_sec=3.0, mock=True)
    stt = build_backend("mock")
    captured: list[Segment] = []
    pipeline = CapturePipeline(
        source=source,
        stt=stt,
        client=None,
        on_segment=captured.append,
    )
    out = tmp_path / "t.jsonl"
    result = pipeline.run(
        meeting_url=synthetic_meeting_url(), meeting_id=None, transcript_path=out
    )
    assert len(result.segments) >= 2
    assert len(captured) == len(result.segments)
    assert out.exists()
    assert out.read_text().strip().count("\n") + 1 == len(result.segments)


def test_synthetic_url_is_desktop_scheme() -> None:
    assert synthetic_meeting_url().startswith("desktop://")


def _run_with_fake_client(
    outcomes: list[Any], *, num_segments: int = 3
) -> tuple[FakeIngestClient, Any]:
    source = AudioSource(
        chunk_seconds=1.0, duration_sec=float(num_segments), mock=True
    )
    stt = build_backend("mock")
    client = FakeIngestClient(outcomes)
    pipeline = CapturePipeline(source=source, stt=stt, client=client)
    result = pipeline.run(
        meeting_url=synthetic_meeting_url(),
        meeting_id="meeting-1",
        transcript_path=None,
    )
    return client, result


def test_permanent_ingest_failure_stops_retrying_that_run(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """404/405 (old backend build) permanently disables ingest for the run."""
    monkeypatch.setattr(
        "verdant_capture.pipeline._TRANSIENT_RETRY_BASE_DELAY_SEC", 0.0
    )
    client, result = _run_with_fake_client([None], num_segments=3)
    assert result.ingest_ok is False
    # Only the first segment's attempt should have called the backend; the
    # permanent flag must stop further attempts for the rest of the run.
    assert len(client.calls) == 1


def test_transient_ingest_failure_retries_and_recovers(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A connection error should retry with backoff, not disable ingest."""
    monkeypatch.setattr(
        "verdant_capture.pipeline._TRANSIENT_RETRY_BASE_DELAY_SEC", 0.0
    )
    # First segment: every retry attempt fails transiently, so it lands in
    # the backlog. Second segment: succeeds immediately, which should also
    # flush (replay) the first segment out of the backlog.
    outcomes = [
        BackendError("boom"),
        BackendError("boom"),
        BackendError("boom"),
        True,  # segment 2 succeeds
        True,  # replay of segment 1 succeeds
    ]
    client, result = _run_with_fake_client(outcomes, num_segments=2)
    assert result.ingest_ok is True
    # 3 retries for segment 1 + 1 call for segment 2 + 1 replay call = 5.
    assert len(client.calls) == 5


def test_transient_failure_without_recovery_keeps_backlog(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """If the backend never comes back, ingest_ok stays False (not crash)."""
    monkeypatch.setattr(
        "verdant_capture.pipeline._TRANSIENT_RETRY_BASE_DELAY_SEC", 0.0
    )
    client, result = _run_with_fake_client([BackendError("down")], num_segments=2)
    assert result.ingest_ok is False
    assert len(client.calls) >= 1
