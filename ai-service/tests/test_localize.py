"""Unit tests for summary language localization tagging."""

from app.rag.summarize import _localize
from app.schemas import MeetingInsights


def _insights():
    return MeetingInsights(summary="We aligned on the roadmap.", key_points=[], action_items=[], chapters=[])


def test_english_is_unchanged():
    out = _localize(_insights(), "en")
    assert out.summary == "We aligned on the roadmap."
    assert _localize(_insights(), None).summary == "We aligned on the roadmap."


def test_other_language_is_tagged():
    out = _localize(_insights(), "es")
    assert out.summary.startswith("[es] ")


def test_english_aliases_unchanged():
    assert not _localize(_insights(), "English").summary.startswith("[")
