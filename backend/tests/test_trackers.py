"""Unit tests for the pure tracker scanner."""

from src.trackers import scan_segments

TRACKERS = [
    {"id": "t1", "name": "Pricing", "keywords": ["pricing", "discount"], "enabled": True},
    {"id": "t2", "name": "Competitor", "keywords": ["acme"], "enabled": True},
    {"id": "t3", "name": "Disabled", "keywords": ["pricing"], "enabled": False},
]

SEGS = [
    {"id": "s1", "text": "Let's talk about pricing for the new plan.", "tStartSec": 0},
    {"id": "s2", "text": "Acme offered a steep discount last quarter.", "tStartSec": 10},
    {"id": "s3", "text": "Unrelated chatter about lunch.", "tStartSec": 20},
]


def test_matches_keywords_case_insensitive():
    hits = scan_segments(TRACKERS, SEGS)
    by_tracker = {}
    for h in hits:
        by_tracker.setdefault(h["tracker_id"], []).append(h)
    # t1 pricing -> s1; t1 discount -> s2 (one hit per segment per tracker)
    assert len(by_tracker["t1"]) == 2
    # t2 acme -> s2
    assert len(by_tracker["t2"]) == 1
    assert by_tracker["t2"][0]["segment_id"] == "s2"


def test_disabled_tracker_skipped():
    hits = scan_segments(TRACKERS, SEGS)
    assert all(h["tracker_id"] != "t3" for h in hits)


def test_no_keywords_no_hits():
    hits = scan_segments([{"id": "x", "keywords": [], "enabled": True}], SEGS)
    assert hits == []


def test_one_hit_per_segment_per_tracker():
    segs = [{"id": "s1", "text": "pricing pricing pricing", "tStartSec": 0}]
    hits = scan_segments([TRACKERS[0]], segs)
    assert len(hits) == 1
