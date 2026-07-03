"""Pipeline smoke tests using the mock audio source + mock STT.

These prove the chunk -> segment -> (optional POST) flow end to end without
audio hardware, a model, or a live backend.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest

from parlor_capture.audio.capture import AudioSource
from parlor_capture.client.segments import Segment, segment_from_stt
from parlor_capture.errors import BackendError
from parlor_capture.pipeline import CapturePipeline, synthetic_meeting_url
from parlor_capture.stt import build_backend
from parlor_capture.stt.base import STTResult


class FakeIngestClient:
    """Duck-typed stand-in for ``VerdantClient.post_segments``.

    ``outcomes`` is consumed one entry per call to decide how that call
    behaves: ``True``/``False`` returns directly (mirroring the real
    client's permanent-404/405-vs-success return value), and a
    ``BaseException`` instance is raised. An :class:`Exception` (e.g.
    :class:`BackendError`) mirrors a transient failure the pipeline itself
    catches and retries; a bare ``BaseException`` (e.g.
    ``KeyboardInterrupt``) mirrors an interrupt landing mid-call, which the
    pipeline does *not* catch and must instead propagate while still
    preserving any not-yet-processed backlog items. Once exhausted, the
    last outcome repeats.
    """

    def __init__(self, outcomes: list[Any]) -> None:
        self._outcomes = list(outcomes)
        self._last: Any = True
        self.calls: list[list[dict]] = []

    def post_segments(self, meeting_id: str, segments: list[dict]) -> bool:
        self.calls.append(segments)
        outcome = self._outcomes.pop(0) if self._outcomes else self._last
        self._last = outcome
        if isinstance(outcome, BaseException):
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
        "parlor_capture.pipeline._TRANSIENT_RETRY_BASE_DELAY_SEC", 0.0
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
        "parlor_capture.pipeline._TRANSIENT_RETRY_BASE_DELAY_SEC", 0.0
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
        "parlor_capture.pipeline._TRANSIENT_RETRY_BASE_DELAY_SEC", 0.0
    )
    client, result = _run_with_fake_client([BackendError("down")], num_segments=2)
    assert result.ingest_ok is False
    assert len(client.calls) >= 1


def test_replay_does_not_drop_later_items_when_earlier_item_fails_again(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Regression test for #51: a still-failing item during replay must not
    silently discard the untried items queued behind it.

    Segments 1 and 2 both fail transiently and land in the backlog. Segment
    3 then succeeds immediately, which triggers a replay of the backlog in
    order: segment 1 fails again (still transient) and segment 2 succeeds.
    Segment 2 must end up ingested (or, if it hadn't succeeded, still
    present in the backlog) -- never silently vanish.
    """
    monkeypatch.setattr(
        "parlor_capture.pipeline._TRANSIENT_RETRY_BASE_DELAY_SEC", 0.0
    )
    outcomes = [
        # Segment 1: every retry attempt fails transiently -> backlog.
        BackendError("boom"),
        BackendError("boom"),
        BackendError("boom"),
        # Segment 2: every retry attempt fails transiently -> backlog.
        BackendError("boom"),
        BackendError("boom"),
        BackendError("boom"),
        # Segment 3: succeeds immediately -> triggers replay of [1, 2].
        True,
        # Replay of segment 1: fails again on every retry -> re-queued.
        BackendError("boom"),
        BackendError("boom"),
        BackendError("boom"),
        # Replay of segment 2: succeeds. Under the bug, this call never
        # happens because the loop bailed out after segment 1's failure.
        True,
    ]
    client, result = _run_with_fake_client(outcomes, num_segments=3)

    # 3 (seg1) + 3 (seg2) + 1 (seg3) + 3 (replay seg1) + 1 (replay seg2) = 11.
    # Under the bug, the last call (replay of segment 2) never happens, so
    # this would be 10 instead -- the most direct signal that segment 2 was
    # dropped rather than retried.
    assert len(client.calls) == 11

    # Segment 2 succeeded on replay, so it must not still be stuck in an
    # internal backlog waiting for a retry that will never come. The only
    # externally observable proxy for "nothing left un-ingested" is
    # ingest_ok; under the bug this would still read False here because
    # segment 1 legitimately remains queued, masking segment 2's silent
    # loss as an indistinguishable "still down" state.
    assert result.ingest_ok is False  # segment 1 is still legitimately queued
    assert len(result.segments) == 3


def test_replay_retries_all_pending_items_even_when_one_stays_down(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A more direct check on ``_replay_backlog`` itself: with a mixed-outcome
    backlog of 3, an item that fails again must not stop the remaining
    not-yet-tried items from being attempted this same pass.
    """
    monkeypatch.setattr(
        "parlor_capture.pipeline._TRANSIENT_RETRY_BASE_DELAY_SEC", 0.0
    )
    source = AudioSource(chunk_seconds=1.0, duration_sec=1.0, mock=True)
    stt = build_backend("mock")
    client = FakeIngestClient([])
    pipeline = CapturePipeline(source=source, stt=stt, client=client)

    seg_a = segment_from_stt(
        STTResult(text="a", t_start_sec=0.0, t_end_sec=1.0, speaker="Speaker 1")
    )
    seg_b = segment_from_stt(
        STTResult(text="b", t_start_sec=1.0, t_end_sec=2.0, speaker="Speaker 1")
    )
    seg_c = segment_from_stt(
        STTResult(text="c", t_start_sec=2.0, t_end_sec=3.0, speaker="Speaker 1")
    )
    backlog = [seg_a, seg_b, seg_c]

    # seg_a: still transiently failing (3 retry attempts).
    # seg_b: succeeds immediately.
    # seg_c: succeeds immediately.
    client._outcomes = [
        BackendError("boom"),
        BackendError("boom"),
        BackendError("boom"),
        True,
        True,
    ]

    went_permanent = pipeline._replay_backlog("meeting-1", backlog)

    # seg_b and seg_c must have been attempted (and ingested) despite seg_a
    # failing again first. Under the bug, only seg_a would be attempted (3
    # calls) and the loop would return, leaving seg_b/seg_c untouched.
    assert len(client.calls) == 5
    # seg_a is still down and must be the only item re-queued for the next
    # retry -- seg_b and seg_c succeeded and must not reappear here.
    assert backlog == [seg_a]
    # Nothing here was ever a permanent (404/405) failure -- only transient
    # errors and successes -- so the replay must not report one.
    assert went_permanent is False


def test_replay_backlog_reports_permanent_failure_discovered_mid_replay(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Direct check on ``_replay_backlog``'s return value: when an item
    comes back permanent (404/405) mid-replay, the method must report that
    discovery to its caller so ``run()`` can propagate it into
    ``ingest_unavailable`` -- mirroring the main loop's own handling of a
    direct permanent result from ``_try_ingest``.
    """
    monkeypatch.setattr(
        "parlor_capture.pipeline._TRANSIENT_RETRY_BASE_DELAY_SEC", 0.0
    )
    source = AudioSource(chunk_seconds=1.0, duration_sec=1.0, mock=True)
    stt = build_backend("mock")
    client = FakeIngestClient([])
    pipeline = CapturePipeline(source=source, stt=stt, client=client)

    seg_a = segment_from_stt(
        STTResult(text="a", t_start_sec=0.0, t_end_sec=1.0, speaker="Speaker 1")
    )
    seg_b = segment_from_stt(
        STTResult(text="b", t_start_sec=1.0, t_end_sec=2.0, speaker="Speaker 1")
    )
    backlog = [seg_a, seg_b]

    # seg_a: comes back permanent (404/405) on replay.
    client._outcomes = [None]

    went_permanent = pipeline._replay_backlog("meeting-1", backlog)

    assert went_permanent is True
    # Only seg_a's single attempt should have called the backend; seg_b is
    # intentionally never attempted once ingest is known permanently gone.
    assert len(client.calls) == 1
    # Neither segment is re-queued -- a permanent failure never retries.
    assert backlog == []


def test_permanent_failure_discovered_during_replay_stops_retrying_that_run(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Regression test for #51 (reviewer follow-up): a permanent (404/405)
    failure discovered *inside* a replay pass -- not on the main loop's own
    direct ``_try_ingest`` call -- must still flip ``ingest_unavailable`` for
    the rest of the run, exactly like ``test_permanent_ingest_failure_stops_
    retrying_that_run`` does for a first-attempt permanent failure.

    Segments 1 and 2 both fail transiently and land in the backlog. Segment
    3 then succeeds immediately, which triggers a replay of the backlog in
    order: segment 1 comes back permanent (404/405) mid-replay. Under the
    bug, that discovery stayed local to ``_replay_backlog`` and never
    reached ``run()``, so ``ingest_ok`` would read ``True`` even though
    segments 1 and 2 were both permanently lost and never ingested.

    Segment 4 exists purely to prove the "no further ingest attempts happen
    after that for the remainder of the run" half of the fix: once the
    replay discovers the permanent failure, ``run()`` must never call the
    backend again this run, including for brand-new segments produced
    afterward.
    """
    monkeypatch.setattr(
        "parlor_capture.pipeline._TRANSIENT_RETRY_BASE_DELAY_SEC", 0.0
    )
    outcomes = [
        # Segment 1: every retry attempt fails transiently -> backlog.
        BackendError("boom"),
        BackendError("boom"),
        BackendError("boom"),
        # Segment 2: every retry attempt fails transiently -> backlog.
        BackendError("boom"),
        BackendError("boom"),
        BackendError("boom"),
        # Segment 3: succeeds immediately -> triggers replay of [1, 2].
        True,
        # Replay of segment 1: backend has no ingest endpoint at all now
        # (permanent, 404/405-equivalent).
        None,
        # Segment 4 would be next, but must never be attempted: once the
        # replay discovers the permanent failure, ``ingest_unavailable``
        # must gate every subsequent segment for the rest of the run. If
        # the fix is missing, this outcome would be consumed as a
        # (successful) attempt on segment 4, which the assertions below
        # would catch via the call count and ``result.ingest_ok``.
        True,
    ]
    client, result = _run_with_fake_client(outcomes, num_segments=4)

    # 3 (seg1) + 3 (seg2) + 1 (seg3) + 1 (replay seg1, permanent -> no
    # retries) = 8. Segment 2's replay must never be attempted (the
    # permanent discovery stops the rest of the backlog this pass), and
    # segment 4 must never be attempted either (ingest_unavailable now
    # gates the main loop for the rest of the run).
    assert len(client.calls) == 8

    # The crux of this regression: a permanent failure discovered mid-replay
    # must propagate into ``ingest_unavailable`` just like a permanent
    # failure discovered on the main loop's first-ever attempt does. Under
    # the bug, ``ingest_ok`` would read ``True`` here (a false-positive
    # success signal) because ``run()`` never learned the replay went
    # permanent, and segment 4 would then have been ingested normally.
    assert result.ingest_ok is False
    assert len(result.segments) == 4


def test_replay_backlog_preserves_unprocessed_items_on_interrupt(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Regression test for #125: a ``KeyboardInterrupt`` (or any exception)
    unwinding out of ``_try_ingest`` mid-replay-loop must not silently drop
    items from ``pending`` that haven't been re-classified yet. Both the
    in-flight segment (whose outcome is unknown when the exception hits)
    and every segment still waiting behind it must land back in ``backlog``.
    """
    monkeypatch.setattr(
        "parlor_capture.pipeline._TRANSIENT_RETRY_BASE_DELAY_SEC", 0.0
    )
    source = AudioSource(chunk_seconds=1.0, duration_sec=1.0, mock=True)
    stt = build_backend("mock")
    client = FakeIngestClient([])
    pipeline = CapturePipeline(source=source, stt=stt, client=client)

    seg_a = segment_from_stt(
        STTResult(text="a", t_start_sec=0.0, t_end_sec=1.0, speaker="Speaker 1")
    )
    seg_b = segment_from_stt(
        STTResult(text="b", t_start_sec=1.0, t_end_sec=2.0, speaker="Speaker 1")
    )
    seg_c = segment_from_stt(
        STTResult(text="c", t_start_sec=2.0, t_end_sec=3.0, speaker="Speaker 1")
    )
    backlog = [seg_a, seg_b, seg_c]

    original_try_ingest = pipeline._try_ingest
    calls: list[Segment] = []

    def _try_ingest_interrupt_on_b(meeting_id: str, segment: Segment) -> Any:
        calls.append(segment)
        if segment is seg_b:
            raise KeyboardInterrupt()
        return original_try_ingest(meeting_id, segment)

    monkeypatch.setattr(pipeline, "_try_ingest", _try_ingest_interrupt_on_b)

    with pytest.raises(KeyboardInterrupt):
        pipeline._replay_backlog("meeting-1", backlog)

    # seg_a succeeded (replayed) before the interrupt landed while
    # processing seg_b.
    assert calls == [seg_a, seg_b]
    # seg_b (in flight when the interrupt hit) and seg_c (never reached)
    # must both survive back into `backlog` -- never silently dropped.
    assert backlog == [seg_b, seg_c]


def test_run_preserves_backlog_when_interrupted_mid_replay(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """End-to-end regression test for #125's exact repro: 3 segments land in
    the backlog after transient failures, a 4th succeeds and triggers a
    replay, and a ``KeyboardInterrupt`` lands on the very first replay
    attempt. Under the bug, ``_replay_backlog`` had already cleared its
    live ``backlog`` reference before the loop started, so the interrupt
    would silently drop all three queued segments and (per the issue's
    concrete repro) the top-level ``KeyboardInterrupt`` handler in
    ``cli.py`` would swallow the interrupt and report success. This test
    stays at the ``run()`` level -- the earliest point the fix is
    externally observable -- and asserts ``ingest_ok`` never lies.
    """
    monkeypatch.setattr(
        "parlor_capture.pipeline._TRANSIENT_RETRY_BASE_DELAY_SEC", 0.0
    )
    outcomes = [
        # Segment 1: every retry attempt fails transiently -> backlog.
        BackendError("boom"),
        BackendError("boom"),
        BackendError("boom"),
        # Segment 2: every retry attempt fails transiently -> backlog.
        BackendError("boom"),
        BackendError("boom"),
        BackendError("boom"),
        # Segment 3: every retry attempt fails transiently -> backlog.
        BackendError("boom"),
        BackendError("boom"),
        BackendError("boom"),
        # Segment 4: succeeds immediately -> triggers replay of [1, 2, 3].
        True,
        # Replay of segment 1: interrupted mid-attempt (e.g. Ctrl-C).
        KeyboardInterrupt(),
    ]
    client, result = _run_with_fake_client(outcomes, num_segments=4)

    # 3 (seg1) + 3 (seg2) + 3 (seg3) + 1 (seg4) + 1 (replay seg1, raises) = 11.
    assert len(client.calls) == 11
    # The crux of the regression: an interrupt mid-replay must never be
    # allowed to report a false-positive success. Under the bug this would
    # read True (segments 1-3 silently vanished from the backlog), which is
    # exactly the false "Segments streamed to backend" the issue describes.
    assert result.ingest_ok is False
    assert len(result.segments) == 4
