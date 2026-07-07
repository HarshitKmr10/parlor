"""Shared fixture-loading helper for the eval harness.

Not a test module itself (no ``test_`` prefix, so pytest won't collect it).
Fixtures are plain JSON transcripts under ``tests/evals/fixtures/`` shaped
like the real ``/summarize`` request body (``meetingId``, ``title``,
``segments``), using the same camelCase field names ``TranscriptSegment``
expects on the wire.
"""

from __future__ import annotations

import json
from pathlib import Path

from app.schemas import MeetingMeta, TranscriptSegment

_FIXTURES_DIR = Path(__file__).parent / "fixtures"


def load_fixture(name: str) -> dict:
    """Load a fixture JSON file by name, e.g. ``load_fixture("decision_meeting")``."""
    path = _FIXTURES_DIR / f"{name}.json"
    with path.open() as f:
        return json.load(f)


def fixture_segments(name: str) -> list[TranscriptSegment]:
    data = load_fixture(name)
    return [TranscriptSegment.model_validate(s) for s in data["segments"]]


def fixture_meta(name: str) -> MeetingMeta:
    data = load_fixture(name)
    return MeetingMeta(title=data["title"], participants=[])


def fixture_transcript_char_count(name: str) -> int:
    """Total character count of all segment text -- the "input length" the
    generated summary is compared against."""
    return sum(len(s.text) for s in fixture_segments(name))
