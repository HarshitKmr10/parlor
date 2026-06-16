"""Pipeline smoke tests using the mock audio source + mock STT.

These prove the chunk -> segment -> (optional POST) flow end to end without
audio hardware, a model, or a live backend.
"""

from __future__ import annotations

from pathlib import Path

from verdant_capture.audio.capture import AudioSource
from verdant_capture.client.segments import Segment, segment_from_stt
from verdant_capture.pipeline import CapturePipeline, synthetic_meeting_url
from verdant_capture.stt import build_backend
from verdant_capture.stt.base import STTResult


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
