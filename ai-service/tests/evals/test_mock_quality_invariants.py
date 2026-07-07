"""Mock-mode content-quality invariants for /summarize.

These are the eval harness's CI-safe tier: they run with no LLM keys (mode
"mock", mirroring test_router.py/test_summarize_fallback.py's ``Settings(...,
mode="mock")`` convention) and exercise the real mock-provider summarization
pipeline end to end via ``summarize_meeting`` -- not the HTTP layer, matching
how test_summarize_chunking.py/test_localize.py call rag functions directly.

Every assertion here was written only after reading app/providers/mock_provider.py
so it targets an invariant the mock code actually guarantees, not a coincidence
of one sample run. In particular: MockProvider.complete_json ALWAYS appends a
placeholder action item ("[mock] Review meeting notes.", assignee=None) when a
transcript has segments but none matched the follow-up regex -- so "action
items list is non-empty" is true unconditionally and would be a vacuous
assertion. The rambling-transcript test instead pins the placeholder's exact,
honest shape (no fabricated owner) as the real invariant.
"""

from __future__ import annotations

import pytest

from app.config import Settings
from app.providers.router import ProviderRouter
from app.rag.summarize import summarize_meeting

from ._helpers import fixture_meta, fixture_segments, fixture_transcript_char_count

_ALL_FIXTURES = [
    "decision_meeting",
    "standup_status",
    "action_items_with_owners",
    "rambling_no_action_items",
    "short_meeting",
    "chat_topic_meeting",
]


def _mock_settings() -> Settings:
    return Settings(
        anthropic_api_key=None,
        openai_api_key=None,
        azure_openai_endpoint=None,
        azure_openai_api_key=None,
        azure_openai_api_version="2024-02-15-preview",
        azure_openai_deployment="gpt-5.4-mini",
        azure_openai_embedding_deployment=None,
        provider_order=[],
        database_url=None,
        mode="mock",
    )


async def _summarize_fixture(name: str):
    router = ProviderRouter(_mock_settings())
    segments = fixture_segments(name)
    meta = fixture_meta(name)
    return await summarize_meeting(
        router, meeting_id=name, meta=meta, segments=segments
    )


@pytest.mark.parametrize("fixture_name", _ALL_FIXTURES)
async def test_summary_is_non_empty_and_shorter_than_transcript(fixture_name: str):
    insights = await _summarize_fixture(fixture_name)

    assert insights.summary.strip()
    transcript_chars = fixture_transcript_char_count(fixture_name)
    assert len(insights.summary) < transcript_chars, (
        f"mock summary ({len(insights.summary)} chars) was not shorter than "
        f"the {fixture_name} transcript ({transcript_chars} chars)"
    )


async def test_action_items_fixture_extracts_owner_and_text_per_speaker():
    """Both speakers in action_items_with_owners.json state their commitment
    in the first person ("I will..."), which is exactly the shape
    MockProvider.complete_json's follow-up regex + speaker-attribution
    heuristic picks up -- so this is a real (not vacuous) check that each
    action item carries a non-empty task description and a populated
    assignee matching who actually said it."""
    insights = await _summarize_fixture("action_items_with_owners")

    assert len(insights.action_items) == 2
    assignees = {item.assignee for item in insights.action_items}
    assert assignees == {"Alice", "Bob"}
    for item in insights.action_items:
        assert item.text.strip()
        assert item.assignee


async def test_rambling_transcript_gets_honest_placeholder_not_a_fabricated_owner():
    """None of rambling_no_action_items.json's lines match MockProvider's
    follow-up regex (``will|need to|action|todo|follow up|let's|by next``),
    so the mock provider falls back to its single generic placeholder action
    item with no assignee. The real, non-vacuous invariant for this fixture
    is that the placeholder stays exactly that -- unattributed and generic --
    rather than the mock inventing an owner or task that was never said."""
    insights = await _summarize_fixture("rambling_no_action_items")

    assert len(insights.action_items) == 1
    placeholder = insights.action_items[0]
    assert placeholder.text == "[mock] Review meeting notes."
    assert placeholder.assignee is None


async def test_decision_meeting_key_points_reflect_actual_transcript_content():
    """MockProvider's keyPoints are literal truncated excerpts of the first
    five segments' text (not paraphrased) -- so each key point must actually
    appear as a substring of the transcript, not be invented."""
    segments = fixture_segments("decision_meeting")
    insights = await _summarize_fixture("decision_meeting")

    transcript_text = " ".join(s.text for s in segments)
    assert insights.key_points
    for point in insights.key_points:
        assert point in transcript_text
