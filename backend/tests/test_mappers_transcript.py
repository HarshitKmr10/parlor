"""Regression tests for transcript segment projection.

asyncpg returns ``json``/``jsonb`` columns as JSON *strings*. The cross-meeting
search path passes the raw column to ``segments_from_transcript``, so the mapper
must decode a string form — otherwise snippets are silently always empty.
"""

import json

from src.api.product.mappers import segments_from_transcript

_TRANSCRIPT = {
    "content": [
        {
            "id": "seg-1",
            "speaker": "Alice",
            "speakerId": "u-alice",
            "text": "The billing migration is the top priority.",
            "startTime": 0,
            "endTime": 12,
        },
        {
            "id": "seg-2",
            "speaker": "Bob",
            "speakerId": "u-bob",
            "text": "Agreed, let's finish it by Friday.",
            "startTime": 12,
            "endTime": 30,
        },
    ]
}


def test_segments_from_transcript_parses_dict():
    segments = segments_from_transcript(_TRANSCRIPT)
    assert len(segments) == 2
    assert segments[0].speaker_name == "Alice"
    assert "billing migration" in segments[0].text
    assert segments[0].t_start_sec == 0.0
    assert segments[1].t_end_sec == 30.0


def test_segments_from_transcript_parses_json_string():
    # This is exactly what asyncpg hands back for a json column.
    segments = segments_from_transcript(json.dumps(_TRANSCRIPT))
    assert len(segments) == 2
    assert segments[0].speaker_name == "Alice"
    assert "billing migration" in segments[0].text


def test_segments_from_transcript_handles_empty_and_garbage():
    assert segments_from_transcript(None) == []
    assert segments_from_transcript("") == []
    assert segments_from_transcript("not json") == []
    assert segments_from_transcript({"content": "not a list"}) == []
    assert segments_from_transcript(json.dumps({"content": []})) == []
