"""Unit tests for deterministic conversation analytics."""

from dataclasses import dataclass

from src.analytics import compute_meeting_analytics


@dataclass
class Seg:
    speaker_name: str
    text: str
    t_start_sec: float
    t_end_sec: float


def test_empty_transcript_returns_zeroed_metrics():
    a = compute_meeting_analytics("m1", [])
    assert a.meeting_id == "m1"
    assert a.num_speakers == 0
    assert a.total_words == 0
    assert a.speakers == []
    assert a.balance_score == 0.0


def test_talk_time_and_ratio_split_between_speakers():
    segs = [
        Seg("Alice", "Hello everyone welcome", 0.0, 30.0),  # 30s
        Seg("Bob", "Hi thanks", 30.0, 40.0),  # 10s
    ]
    a = compute_meeting_analytics("m1", segs)
    assert a.num_speakers == 2
    assert a.duration_sec == 40.0
    by_name = {s.speaker_name: s for s in a.speakers}
    assert by_name["Alice"].talk_time_sec == 30.0
    assert round(by_name["Alice"].talk_ratio, 2) == 0.75
    assert round(by_name["Bob"].talk_ratio, 2) == 0.25
    # speakers are ordered by talk time desc
    assert a.speakers[0].speaker_name == "Alice"


def test_word_count_and_wpm():
    segs = [Seg("Alice", "one two three four five six", 0.0, 60.0)]  # 6 words / 1 min
    a = compute_meeting_analytics("m1", segs)
    assert a.total_words == 6
    assert a.words_per_minute == 6.0
    assert a.speakers[0].words_per_minute == 6.0


def test_turns_counted_per_contiguous_run():
    segs = [
        Seg("Alice", "a", 0.0, 5.0),
        Seg("Alice", "b", 5.0, 10.0),  # same speaker → still one turn so far
        Seg("Bob", "c", 10.0, 15.0),
        Seg("Alice", "d", 15.0, 20.0),  # Alice again → her second turn
    ]
    a = compute_meeting_analytics("m1", segs)
    by_name = {s.speaker_name: s for s in a.speakers}
    assert by_name["Alice"].turns == 2
    assert by_name["Bob"].turns == 1
    assert a.num_turns == 3


def test_longest_monologue_spans_contiguous_run():
    segs = [
        Seg("Alice", "x", 0.0, 20.0),
        Seg("Alice", "y", 20.0, 50.0),  # contiguous run 0..50 = 50s
        Seg("Bob", "z", 50.0, 55.0),
    ]
    a = compute_meeting_analytics("m1", segs)
    assert a.longest_monologue_sec == 50.0
    assert a.longest_monologue_speaker == "Alice"


def test_questions_and_filler_words_counted():
    segs = [
        Seg("Alice", "So um, like, what do you think? Is it ready?", 0.0, 20.0),
    ]
    a = compute_meeting_analytics("m1", segs)
    assert a.question_count == 2
    # "um", "like", "you know"? -> um + like = 2 fillers here
    assert a.filler_word_count >= 2
    assert a.speakers[0].questions_asked == 2


def test_sentiment_positive_and_negative():
    pos = compute_meeting_analytics(
        "m1", [Seg("Alice", "This is great, excellent work, I love it", 0.0, 10.0)]
    )
    assert pos.overall_sentiment == "positive"
    assert pos.overall_sentiment_score > 0

    neg = compute_meeting_analytics(
        "m2",
        [Seg("Bob", "This is terrible, a bad broken failure, I hate it", 0.0, 10.0)],
    )
    assert neg.overall_sentiment == "negative"
    assert neg.overall_sentiment_score < 0


def test_balance_score_even_split_is_high():
    segs = [
        Seg("Alice", "aaa", 0.0, 30.0),
        Seg("Bob", "bbb", 30.0, 60.0),
    ]
    a = compute_meeting_analytics("m1", segs)
    assert a.balance_score == 100.0  # perfectly even two-way split


def test_balance_score_dominated_is_low():
    segs = [
        Seg("Alice", "aaa", 0.0, 95.0),
        Seg("Bob", "b", 95.0, 100.0),
    ]
    a = compute_meeting_analytics("m1", segs)
    assert a.balance_score < 50.0


def test_single_speaker_monologue_has_zero_balance():
    segs = [Seg("Alice", "talking the whole time", 0.0, 100.0)]
    a = compute_meeting_analytics("m1", segs)
    assert a.num_speakers == 1
    assert a.balance_score == 0.0


def test_interactivity_increases_with_more_turns():
    calm = compute_meeting_analytics(
        "m1",
        [Seg("Alice", "x", 0.0, 30.0), Seg("Bob", "y", 30.0, 60.0)],
    )
    lively = compute_meeting_analytics(
        "m2",
        [
            Seg("Alice" if i % 2 == 0 else "Bob", "x", float(i), float(i + 1))
            for i in range(60)
        ],
    )
    assert lively.interactivity_score > calm.interactivity_score
    assert 0.0 <= lively.interactivity_score <= 100.0
