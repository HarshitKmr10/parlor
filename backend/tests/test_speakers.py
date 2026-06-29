"""Unit tests for speaker-profile resolution (pure)."""

from src.speakers import apply_speaker_profiles, build_alias_map

PROFILES = [
    {"display_name": "Alice Chen", "aliases": ["Speaker 1", "alice"]},
    {"display_name": "Bob Ito", "aliases": ["Speaker 2"]},
]


def test_build_alias_map_lowercases_and_self_maps():
    m = build_alias_map(PROFILES)
    assert m["speaker 1"] == "Alice Chen"
    assert m["alice"] == "Alice Chen"
    assert m["alice chen"] == "Alice Chen"  # display name self-resolves
    assert m["speaker 2"] == "Bob Ito"


def test_apply_renames_matching_segments_without_mutation():
    segs = [
        {"speakerName": "Speaker 1", "text": "hi"},
        {"speakerName": "Bob Ito", "text": "yo"},
        {"speakerName": "Unknown Guest", "text": "?"},
    ]
    out = apply_speaker_profiles(segs, build_alias_map(PROFILES))
    assert out[0]["speakerName"] == "Alice Chen"
    assert out[1]["speakerName"] == "Bob Ito"
    assert out[2]["speakerName"] == "Unknown Guest"  # unmapped untouched
    # original input is not mutated
    assert segs[0]["speakerName"] == "Speaker 1"


def test_empty_alias_map_is_noop_copy():
    segs = [{"speakerName": "Speaker 1"}]
    out = apply_speaker_profiles(segs, {})
    assert out[0]["speakerName"] == "Speaker 1"
    assert out is not segs
