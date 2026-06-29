"""Unit tests for coaching scorecard heuristics."""

from types import SimpleNamespace

from src.coaching import compute_coaching


def _spk(name, ratio, q=0, filler=0, wpm=140):
    return SimpleNamespace(
        speaker_name=name,
        talk_ratio=ratio,
        questions_asked=q,
        words_per_minute=wpm,
        filler_word_count=filler,
    )


def _analytics(**over):
    base = dict(
        meeting_id="m1",
        duration_sec=600.0,
        balance_score=90.0,
        question_count=5,
        longest_monologue_sec=30.0,
        speakers=[_spk("Alice", 0.5, q=3), _spk("Bob", 0.5, q=2)],
    )
    base.update(over)
    return SimpleNamespace(**base)


def test_balanced_call_scores_well():
    out = compute_coaching(_analytics())
    assert out["overall_grade"] in ("A", "B")
    assert out["tips"] == ["Well-balanced conversation — keep it up."]
    assert len(out["per_speaker"]) == 2


def test_dominating_rep_is_penalized_and_advised():
    out = compute_coaching(
        _analytics(speakers=[_spk("Rep", 0.8, q=0), _spk("Buyer", 0.2)], question_count=0)
    )
    assert out["talk_ratio_top"] == 0.8
    assert any("listen more" in t for t in out["tips"])
    assert any("discovery" in t for t in out["tips"])
    assert out["overall_score"] < 90


def test_long_monologue_flagged():
    out = compute_coaching(_analytics(longest_monologue_sec=200.0))
    assert any("monologue" in t.lower() for t in out["tips"])
