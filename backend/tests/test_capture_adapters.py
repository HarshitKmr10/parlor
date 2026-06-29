"""Unit tests for botless native-capture adapters (pure)."""

import pytest

from src.capture import normalize, normalize_teams, normalize_vtt, normalize_zoom


def test_zoom_entries():
    payload = {
        "transcript": [
            {"start_time": 0, "end_time": 5, "speaker": "Alice", "text": "Hi there"},
            {"start_time": 5, "end_time": 9, "speaker": "Bob", "text": "Hello"},
        ]
    }
    segs = normalize_zoom(payload)
    assert len(segs) == 2
    assert segs[0]["speakerName"] == "Alice"
    assert segs[0]["tStartSec"] == 0.0 and segs[0]["tEndSec"] == 5.0
    assert segs[1]["text"] == "Hello"


def test_teams_iso_durations():
    payload = {
        "entries": [
            {"speakerDisplayName": "Carol", "text": "Welcome", "startOffset": "PT1M3S", "endOffset": "PT1M10S"},
        ]
    }
    segs = normalize_teams(payload)
    assert segs[0]["speakerName"] == "Carol"
    assert segs[0]["tStartSec"] == 63.0
    assert segs[0]["tEndSec"] == 70.0


def test_vtt_with_speaker_voice_tags():
    vtt = """WEBVTT

00:00:00.000 --> 00:00:04.000
<v Alice>We will finish billing by Friday.

00:00:04.000 --> 00:00:07.500
<v Bob>Sounds good.
"""
    segs = normalize_vtt(vtt)
    assert len(segs) == 2
    assert segs[0]["speakerName"] == "Alice"
    assert "billing" in segs[0]["text"]
    assert segs[1]["tStartSec"] == 4.0
    assert segs[1]["tEndSec"] == 7.5


def test_normalize_dispatch_and_unknown():
    assert normalize("zoom", {"transcript": [{"text": "x", "speaker": "A", "start_time": 0, "end_time": 1}]})
    with pytest.raises(ValueError):
        normalize("webex", {})


def test_empty_text_filtered():
    assert normalize_zoom({"transcript": [{"text": "", "speaker": "A"}]}) == []
