"""Unit tests for developer webhooks: signing, events, SSRF guard, repo."""

import json
from unittest.mock import AsyncMock

import pytest

from src.webhooks import (
    EVENT_TYPES,
    WebhooksRepo,
    backoff_seconds,
    build_signature_header,
    event_matches,
    generate_secret,
    sign_payload,
    verify_signature,
)
from src.webhooks.events import is_known_event
from src.webhooks.safety import InvalidWebhookUrl, validate_webhook_url

# ── signing ─────────────────────────────────────────────────────────────────


def test_sign_is_deterministic_and_secret_dependent():
    a = sign_payload("sec1", '{"x":1}', 1000)
    b = sign_payload("sec1", '{"x":1}', 1000)
    c = sign_payload("sec2", '{"x":1}', 1000)
    assert a == b
    assert a != c


def test_signature_roundtrip_verifies():
    secret, body, ts = generate_secret(), '{"hello":"world"}', 1_700_000_000
    header = build_signature_header(secret, body, ts)
    assert header.startswith(f"t={ts},v1=")
    assert verify_signature(secret, body, header, now=ts) is True


def test_verify_rejects_tampered_body():
    secret, ts = "sec", 1_700_000_000
    header = build_signature_header(secret, '{"a":1}', ts)
    assert verify_signature(secret, '{"a":2}', header, now=ts) is False


def test_verify_rejects_stale_timestamp():
    secret, ts = "sec", 1_700_000_000
    header = build_signature_header(secret, "{}", ts)
    assert verify_signature(secret, "{}", header, now=ts + 10_000) is False


# ── events / backoff ────────────────────────────────────────────────────────


def test_empty_subscription_matches_all():
    assert event_matches("meeting.completed", []) is True
    assert event_matches("meeting.completed", None) is True


def test_subscription_filters():
    assert event_matches("summary.ready", ["summary.ready"]) is True
    assert event_matches("meeting.completed", ["summary.ready"]) is False


def test_known_events():
    assert is_known_event("meeting.completed") is True
    assert is_known_event("not.an.event") is False
    assert "transcript.ready" in EVENT_TYPES


def test_backoff_is_monotonic_and_caps():
    seq = [backoff_seconds(i) for i in range(1, 8)]
    assert seq[0] <= seq[1] <= seq[2]  # grows
    assert seq[-1] == seq[-2]  # saturates at the cap
    assert all(s > 0 for s in seq)


def test_generate_secret_prefixed_and_unique():
    a, b = generate_secret(), generate_secret()
    assert a.startswith("whsec_") and a != b


# ── SSRF guard ──────────────────────────────────────────────────────────────


def test_url_must_be_https():
    with pytest.raises(InvalidWebhookUrl):
        validate_webhook_url("http://example.com/hook")


@pytest.mark.parametrize(
    "url",
    [
        "https://localhost/hook",
        "https://127.0.0.1/hook",
        "https://10.0.0.5/hook",
        "https://169.254.169.254/latest/meta-data",
        "https://192.168.1.1/hook",
        "https://foo.internal/hook",
    ],
)
def test_url_blocks_private_and_local(url):
    with pytest.raises(InvalidWebhookUrl):
        validate_webhook_url(url)


def test_url_allows_public_https():
    assert validate_webhook_url("https://hooks.example.com/abc") == (
        "https://hooks.example.com/abc"
    )


# ── repo (mocked) ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_endpoints_for_event_only_enabled_and_scoped():
    db = AsyncMock()
    db.store.query_raw = AsyncMock(return_value=[])
    repo = WebhooksRepo(db)
    await repo.endpoints_for_event("w1")
    sql, *params = db.store.query_raw.await_args.args
    assert "workspace_id = $1::uuid" in sql and "enabled = TRUE" in sql
    assert params == ["w1"]


@pytest.mark.asyncio
async def test_enqueue_serializes_payload_jsonb():
    db = AsyncMock()
    db.store.query_raw = AsyncMock(
        return_value=[
            {
                "id": "d1",
                "endpoint_id": "e1",
                "workspace_id": "w1",
                "event_id": "ev1",
                "event_type": "meeting.completed",
                "payload": '{"a":1}',
                "status": "pending",
                "attempts": 0,
                "max_attempts": 6,
                "response_status": None,
                "error": None,
                "next_attempt_at": None,
                "delivered_at": None,
                "created_at": None,
                "updated_at": None,
            }
        ]
    )
    repo = WebhooksRepo(db)
    row = await repo.enqueue(
        endpoint_id="e1",
        workspace_id="w1",
        event_id="ev1",
        event_type="meeting.completed",
        payload={"a": 1},
    )
    # payload arg serialized to a JSON string for ::jsonb cast
    _, *params = db.store.query_raw.await_args.args
    assert json.loads(params[4]) == {"a": 1}
    # returned row's string payload is parsed back to a dict
    assert row["payload"] == {"a": 1}


@pytest.mark.asyncio
async def test_requeue_returns_false_when_no_row():
    db = AsyncMock()
    db.store.query_raw = AsyncMock(return_value=[])
    repo = WebhooksRepo(db)
    assert await repo.requeue("d1", "w1") is False


# ── WebhookService.deliver_one state machine ────────────────────────────────


def _delivery(**over):
    base = {
        "id": "d1",
        "endpoint_id": "e1",
        "workspace_id": "w1",
        "event_type": "meeting.completed",
        "payload": {"id": "ev1", "type": "meeting.completed", "data": {}},
        "attempts": 0,
        "max_attempts": 3,
        "url": "https://hooks.example.com/x",
        "secret": "whsec_abc",
    }
    base.update(over)
    return base


def _mock_http(status_code=None, raises=None):
    from unittest.mock import MagicMock

    client = AsyncMock()
    if raises is not None:
        client.post = AsyncMock(side_effect=raises)
    else:
        resp = MagicMock()
        resp.status_code = status_code
        client.post = AsyncMock(return_value=resp)
    return client


@pytest.mark.asyncio
async def test_deliver_one_success_marks_delivered_and_signs():
    from src.webhooks.service import WebhookService

    db = AsyncMock()
    db.store.query_raw = AsyncMock(return_value=[])
    svc = WebhookService(db)
    svc._repo = AsyncMock()
    client = _mock_http(status_code=200)

    ok = await svc.deliver_one(_delivery(), client=client)
    assert ok is True
    svc._repo.mark_delivered.assert_awaited_once()
    # signed headers present
    _, kwargs = client.post.call_args
    assert kwargs["headers"]["X-Parlor-Signature"].startswith("t=")
    assert kwargs["headers"]["X-Parlor-Event-Type"] == "meeting.completed"


@pytest.mark.asyncio
async def test_deliver_one_5xx_schedules_retry():
    from src.webhooks.service import WebhookService

    db = AsyncMock()
    svc = WebhookService(db)
    svc._repo = AsyncMock()
    client = _mock_http(status_code=503)

    ok = await svc.deliver_one(_delivery(attempts=0, max_attempts=3), client=client)
    assert ok is False
    svc._repo.mark_retry.assert_awaited_once()
    svc._repo.mark_failed.assert_not_awaited()


@pytest.mark.asyncio
async def test_deliver_one_final_attempt_marks_failed():
    from src.webhooks.service import WebhookService

    db = AsyncMock()
    db.store.query_raw = AsyncMock(return_value=[{"consecutive_failures": 0}])
    svc = WebhookService(db)
    svc._repo = AsyncMock()
    client = _mock_http(raises=RuntimeError("connection refused"))

    # attempts already 2, max 3 → this attempt (3rd) is terminal
    ok = await svc.deliver_one(_delivery(attempts=2, max_attempts=3), client=client)
    assert ok is False
    svc._repo.mark_failed.assert_awaited_once()
    svc._repo.mark_retry.assert_not_awaited()
