"""Unit tests for proactive during-call assist (deterministic)."""

from dataclasses import dataclass

from app.assist import compute_assist


@dataclass
class Seg:
    text: str


def test_empty_transcript_flags_all_gaps():
    out = compute_assist([])
    assert out["segment_count"] == 0
    # Nothing covered yet -> every checkpoint is a gap.
    assert "next steps" in out["coverage_gaps"]
    assert "owners" in out["coverage_gaps"]
    assert len(out["suggested_questions"]) == 3


def test_detects_covered_checkpoints():
    segs = [
        Seg("I will own the database cutover and we will finish it by Friday."),
        Seg("We agreed the decision is to migrate first."),
        Seg("One risk is the data volume during the cutover."),
    ]
    out = compute_assist(segs)
    gaps = set(out["coverage_gaps"])
    # next steps / owners / timeline / risks / decision all touched.
    assert "next steps" not in gaps
    assert "owners" not in gaps
    assert "timeline" not in gaps
    assert "risks/blockers" not in gaps
    assert "decision" not in gaps


def test_summary_so_far_is_latest_meaningful_sentence():
    segs = [Seg("Hi."), Seg("Let's discuss the Q3 roadmap in detail. Then lunch.")]
    out = compute_assist(segs)
    assert out["summary_so_far"] == "Let's discuss the Q3 roadmap in detail."
    assert out["segment_count"] == 2
