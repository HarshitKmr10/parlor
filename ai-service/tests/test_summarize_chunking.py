"""Unit tests for the map-reduce summarizer's segment chunking."""

from app.config import MAX_CHARS_PER_CHUNK
from app.rag.summarize import _chunk_segments
from app.schemas import TranscriptSegment


def _segment(seg_id: str, text: str, speaker_name: str = "Alice") -> TranscriptSegment:
    return TranscriptSegment(
        id=seg_id,
        speaker_name=speaker_name,
        text=text,
        t_start_sec=0.0,
    )


def test_normal_segments_are_grouped_under_budget():
    segments = [_segment(str(i), "hello world") for i in range(5)]
    chunks = _chunk_segments(segments)
    assert len(chunks) == 1
    assert sum(len(c) for c in chunks) == 5


def test_oversized_single_segment_is_split_into_multiple_chunks():
    # One segment whose own text alone exceeds MAX_CHARS_PER_CHUNK.
    huge_text = "x" * (MAX_CHARS_PER_CHUNK + 5_000)
    seg = _segment("huge", huge_text)

    chunks = _chunk_segments([seg])

    assert len(chunks) > 1
    for chunk in chunks:
        assert len(chunk) == 1
        rendered_len = len(chunk[0].text) + len(chunk[0].speaker_name) + 16
        assert rendered_len <= MAX_CHARS_PER_CHUNK

    # No text is lost or reordered across the split.
    rejoined = "".join(c[0].text for c in chunks)
    assert rejoined == huge_text


def test_oversized_segment_preserves_metadata_on_each_sub_chunk():
    huge_text = "y" * (MAX_CHARS_PER_CHUNK + 1_000)
    seg = _segment("s1", huge_text, speaker_name="Bob")

    chunks = _chunk_segments([seg])

    assert len(chunks) > 1
    for chunk in chunks:
        assert chunk[0].id == "s1"
        assert chunk[0].speaker_name == "Bob"


def test_normal_segments_around_oversized_segment_still_chunk_correctly():
    before = _segment("before", "hello world")
    huge = _segment("huge", "z" * (MAX_CHARS_PER_CHUNK + 2_000))
    after = _segment("after", "goodbye world")

    chunks = _chunk_segments([before, huge, after])

    # The oversized segment must be split; the small segments should not be
    # folded into any of its oversized sub-chunks.
    all_segments = [s for chunk in chunks for s in chunk]
    assert all_segments[0].id == "before"
    assert all_segments[-1].id == "after"
    for chunk in chunks:
        total = sum(len(s.text) + len(s.speaker_name) + 16 for s in chunk)
        assert total <= MAX_CHARS_PER_CHUNK


def test_segment_exactly_at_budget_is_not_split():
    # seg_len == len(text) + len(speaker_name) + 16; craft text so seg_len
    # lands exactly on MAX_CHARS_PER_CHUNK (boundary is "not > ", so equal
    # should NOT trigger the oversized-split path).
    speaker_name = "Alice"
    overhead = len(speaker_name) + 16
    text = "a" * (MAX_CHARS_PER_CHUNK - overhead)
    seg = _segment("exact", text, speaker_name=speaker_name)

    chunks = _chunk_segments([seg])

    assert len(chunks) == 1
    assert len(chunks[0]) == 1
    assert chunks[0][0].text == text
