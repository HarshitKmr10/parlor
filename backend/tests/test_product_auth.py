"""Unit tests for the /api/v1 product auth + mapping helpers.

These cover the pure logic (password hashing, JWT round-trip, API-key shape,
internal->contract meeting mapping) without needing a database.
"""

from __future__ import annotations

from datetime import datetime, timezone

import jwt
import pytest

from src.api.models.schemas import MeetingRecord, MeetingStatus
from src.api.product import security
from src.api.product.mappers import segments_from_transcript, to_meeting


@pytest.mark.unit
def test_password_hash_round_trip():
    hashed = security.hash_password("supersecret123")
    assert hashed != "supersecret123"
    assert security.verify_password("supersecret123", hashed)
    assert not security.verify_password("wrong", hashed)


@pytest.mark.unit
def test_verify_password_on_garbage_hash_is_false():
    assert security.verify_password("anything", "not-a-real-hash") is False


@pytest.mark.unit
def test_access_token_round_trip():
    token = security.create_access_token(user_id="u-1", email="a@b.com")
    payload = security.decode_access_token(token)
    assert payload["sub"] == "u-1"
    assert payload["email"] == "a@b.com"
    assert payload["type"] == security.ACCESS_TOKEN_TYPE


@pytest.mark.unit
def test_refresh_token_is_not_an_access_token():
    # A refresh token is opaque, not a JWT; decoding it must fail.
    refresh = security.generate_refresh_token()
    with pytest.raises(jwt.PyJWTError):
        security.decode_access_token(refresh)


@pytest.mark.unit
def test_api_key_shape_and_hash():
    full, prefix, key_hash = security.generate_api_key()
    assert full.startswith("mk_")
    assert full.startswith(prefix)
    assert security.looks_like_api_key(full)
    assert security.hash_token(full) == key_hash
    assert len(key_hash) == 64  # sha256 hex


def _record(**overrides) -> MeetingRecord:
    base = dict(
        id="m-1",
        meeting_url="https://meet.google.com/abc-defg-hij",
        status=MeetingStatus.ONGOING,
        created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        updated_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
    )
    base.update(overrides)
    return MeetingRecord(**base)


@pytest.mark.unit
def test_to_meeting_maps_platform_and_status():
    m = to_meeting(_record(), title="Sync")
    assert m.platform == "meet"
    assert m.status == "ongoing"
    assert m.title == "Sync"


@pytest.mark.unit
def test_to_meeting_collapses_internal_statuses():
    assert to_meeting(_record(status=MeetingStatus.NOT_JOINED)).status == "scheduled"
    assert to_meeting(_record(status=MeetingStatus.INTERRUPTED)).status == "ongoing"


@pytest.mark.unit
def test_segments_from_transcript():
    transcript = {
        "content": [
            {
                "id": "s1",
                "speaker": "Alice",
                "text": "Hello team",
                "startTime": 0,
                "endTime": 2,
                "timestamp": "2026-01-01T00:00:00Z",
            },
            {"speaker": "Bob", "text": "", "startTime": 2, "endTime": 3},  # dropped
        ]
    }
    segs = segments_from_transcript(transcript)
    assert len(segs) == 1
    assert segs[0].speaker_name == "Alice"
    assert segs[0].t_start_sec == 0.0
    assert segs[0].t_end_sec == 2.0


@pytest.mark.unit
def test_segments_from_empty_transcript():
    assert segments_from_transcript(None) == []
    assert segments_from_transcript({}) == []
