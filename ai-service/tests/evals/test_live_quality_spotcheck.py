"""Live-mode qualitative spot-check -- NOT part of CI.

Guarded by ``skipif`` on the same env vars app/config.py reads
(``ANTHROPIC_API_KEY`` / ``OPENAI_API_KEY`` / ``AZURE_OPENAI_API_KEY`` +
``AZURE_OPENAI_ENDPOINT``) so this whole module skips cleanly -- not errors,
not silent no-op passes -- when no LLM keys are configured, which is the
normal state for CI and most local runs.

This tier intentionally does simple substring/keyword checks against a real
model's output, no semantic scoring or new eval dependency. It exists so a
human can run it locally before a release to sanity-check that the live
provider chain still extracts named owners and stated tasks correctly, which
the mock tier can't tell us anything about (mock always returns the same
canned shape).

Run locally with a key set, e.g.:

    ANTHROPIC_API_KEY=sk-... PYTHONPATH=. pytest tests/evals/test_live_quality_spotcheck.py -q
"""

from __future__ import annotations

import os

import pytest

from app.config import load_settings
from app.providers.router import ProviderRouter
from app.rag.summarize import summarize_meeting

from ._helpers import fixture_meta, fixture_segments

_HAS_LIVE_KEY = bool(
    os.environ.get("ANTHROPIC_API_KEY")
    or os.environ.get("OPENAI_API_KEY")
    or (os.environ.get("AZURE_OPENAI_API_KEY") and os.environ.get("AZURE_OPENAI_ENDPOINT"))
)

pytestmark = pytest.mark.skipif(
    not _HAS_LIVE_KEY,
    reason="live LLM keys not set (ANTHROPIC_API_KEY / OPENAI_API_KEY / "
    "AZURE_OPENAI_API_KEY+AZURE_OPENAI_ENDPOINT) -- this is a manual "
    "pre-release spot-check, not a CI gate",
)


async def test_live_action_items_mention_the_actual_owners_and_tasks():
    """A real model given action_items_with_owners.json should extract
    Alice/proposal and Bob/migration -- simple keyword checks, no fuzzy
    scoring."""
    settings = load_settings()
    router = ProviderRouter(settings)
    segments = fixture_segments("action_items_with_owners")
    meta = fixture_meta("action_items_with_owners")

    insights = await summarize_meeting(
        router, meeting_id="live-eval-actions-1", meta=meta, segments=segments
    )

    assert insights.action_items, "expected at least one extracted action item"
    all_text = " ".join(
        f"{item.text} {item.assignee or ''}" for item in insights.action_items
    ).lower()

    assert "alice" in all_text
    assert "proposal" in all_text
    assert "bob" in all_text
    assert "migration" in all_text


async def test_live_decision_meeting_summary_names_the_chosen_vendor():
    settings = load_settings()
    router = ProviderRouter(settings)
    segments = fixture_segments("decision_meeting")
    meta = fixture_meta("decision_meeting")

    insights = await summarize_meeting(
        router, meeting_id="live-eval-decision-1", meta=meta, segments=segments
    )

    assert "vendor b" in insights.summary.lower()
