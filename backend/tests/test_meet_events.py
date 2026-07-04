"""Tests for ad-hoc / instant Meet capture (Pass 2).

Everything Google-facing is MOCKED — no live creds, no network. Covers:

  (a) subscription manager creates / renews / deletes (mocked) and persists
  (b) a mocked Pub/Sub conference.started push -> webhook decodes it ->
      resolves a mocked meetingUri -> calls dispatch_meeting once
  (c) a DUPLICATE delivery of the same conference id is ignored (dedupe)
  (d) policy gates dispatch (denylist / opt-out / allowlist)
  (e) webhook rejects a bad/missing verification token
  (f) unconfigured org -> webhook 202 ack-and-ignore; subscribe route -> 400
  (g) end-to-end realistic Pub/Sub envelope -> webhook
"""

from __future__ import annotations

import base64
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from src.integrations.google_workspace.events import (
    EVENT_CONFERENCE_STARTED,
    MeetSpaceResolver,
    SubscriptionResult,
    WorkspaceEventsClient,
)
from src.integrations.google_workspace.policy import (
    MODE_ALLOWLIST,
    MODE_DENYLIST,
    OrgMeetingPolicy,
)
from src.services.meet_events_service import (
    MeetEventsService,
    parse_conference_event,
)

MEET_URI = "https://meet.google.com/abc-defg-hij"
CONFERENCE_ID = "conferenceRecords/conf-123"
SPACE_NAME = "spaces/space-xyz"


# ── helpers ──────────────────────────────────────────────────────────────


def _cloud_event(conference_id=CONFERENCE_ID, space=SPACE_NAME,
                 organizer="host@verdant-test.com",
                 etype=EVENT_CONFERENCE_STARTED, subject="host@verdant-test.com"):
    return {
        "type": etype,
        "subject": subject,
        "data": {
            "conferenceRecord": {
                "name": conference_id,
                "space": space,
                "organizer": {"email": organizer},
            }
        },
    }


def _pubsub_envelope(cloud_event):
    data = base64.b64encode(json.dumps(cloud_event).encode("utf-8")).decode("utf-8")
    return {
        "message": {
            "data": data,
            "messageId": "msg-1",
            "attributes": {"ce-type": cloud_event.get("type")},
        },
        "subscription": "projects/p/subscriptions/s",
    }


# ── (a) subscription manager (mocked Workspace Events API) ─────────────────


def _fake_events_service():
    """MagicMock mimicking the workspaceevents discovery service chain."""
    service = MagicMock()
    subs = service.subscriptions.return_value
    subs.create.return_value.execute.return_value = {
        "name": "subscriptions/sub-1",
        "eventTypes": [EVENT_CONFERENCE_STARTED],
        "expireTime": "2026-06-23T00:00:00Z",
    }
    subs.patch.return_value.execute.return_value = {
        "name": "subscriptions/sub-1",
        "eventTypes": [EVENT_CONFERENCE_STARTED],
        "expireTime": "2026-06-30T00:00:00Z",
    }
    subs.delete.return_value.execute.return_value = {}
    return service


def test_events_client_create_persists():
    auth = MagicMock()
    auth.get_user_credentials.return_value = MagicMock()
    client = WorkspaceEventsClient(auth, pubsub_topic="projects/p/topics/t")
    with patch("googleapiclient.discovery.build", return_value=_fake_events_service()):
        result = client.create_subscription("alice@verdant-test.com")
    assert isinstance(result, SubscriptionResult)
    assert result.subscription_id == "subscriptions/sub-1"
    assert result.target_user_email == "alice@verdant-test.com"
    assert result.expire_time is not None
    assert result.state == "active"


def test_events_client_renew_extends_ttl():
    auth = MagicMock()
    client = WorkspaceEventsClient(auth, pubsub_topic="projects/p/topics/t")
    with patch("googleapiclient.discovery.build", return_value=_fake_events_service()):
        result = client.renew_subscription("alice@x.com", "subscriptions/sub-1")
    assert result.subscription_id == "subscriptions/sub-1"
    assert result.expire_time.isoformat().startswith("2026-06-30")


def test_events_client_delete():
    auth = MagicMock()
    client = WorkspaceEventsClient(auth, pubsub_topic="projects/p/topics/t")
    with patch("googleapiclient.discovery.build", return_value=_fake_events_service()):
        assert client.delete_subscription("alice@x.com", "subscriptions/sub-1") is True


def test_events_client_requires_topic():
    with pytest.raises(ValueError, match="pubsub_topic"):
        WorkspaceEventsClient(MagicMock(), pubsub_topic="")


def test_meet_resolver_resolves_uri_from_space():
    auth = MagicMock()
    service = MagicMock()
    service.spaces.return_value.get.return_value.execute.return_value = {
        "name": SPACE_NAME,
        "meetingUri": MEET_URI,
    }
    resolver = MeetSpaceResolver(auth)
    with patch("googleapiclient.discovery.build", return_value=service):
        uri = resolver.resolve_meeting_uri(user_email="h@x.com", space_name=SPACE_NAME)
    assert uri == MEET_URI


def test_meet_resolver_resolves_via_conference_record():
    auth = MagicMock()
    service = MagicMock()
    service.conferenceRecords.return_value.get.return_value.execute.return_value = {
        "name": CONFERENCE_ID,
        "space": SPACE_NAME,
    }
    service.spaces.return_value.get.return_value.execute.return_value = {
        "meetingUri": MEET_URI
    }
    resolver = MeetSpaceResolver(auth)
    with patch("googleapiclient.discovery.build", return_value=service):
        uri = resolver.resolve_meeting_uri(
            user_email="h@x.com", conference_record=CONFERENCE_ID
        )
    assert uri == MEET_URI


# ── CloudEvent parsing ─────────────────────────────────────────────────────


def test_parse_conference_started_event():
    parsed = parse_conference_event(_cloud_event())
    assert parsed is not None
    assert parsed["conference_id"] == CONFERENCE_ID
    assert parsed["space_name"] == SPACE_NAME
    assert parsed["organizer_email"] == "host@verdant-test.com"
    assert parsed["event_type"] == EVENT_CONFERENCE_STARTED


def test_parse_ignores_non_conference_event():
    assert parse_conference_event({"type": "google.workspace.drive.file.created"}) is None
    assert parse_conference_event({}) is None


# ── service-level dispatch + dedupe (mocked DB + Google + dispatch) ─────────


class _CaptureDb:
    """Fake DB whose query_raw records claims so dedupe can be exercised."""

    def __init__(self):
        self._driver = "not-pg"
        self._claimed = set()
        self.store = MagicMock()
        self.store.query_raw = AsyncMock(side_effect=self._query)

    async def _query(self, sql, *args):
        s = sql.strip()
        if s.startswith("INSERT INTO meet_capture_events"):
            conference_id = args[0]
            if conference_id in self._claimed:
                return []  # ON CONFLICT DO NOTHING -> no row
            self._claimed.add(conference_id)
            return [{"id": "row-1"}]
        # mark_dispatched / tag updates / subscription lookups -> no rows.
        return []


@pytest.fixture
def patched_dispatch(monkeypatch):
    """Patch the service internals: workspace resolution, URI resolve, dispatch."""
    svc = MeetEventsService()
    dispatch_mock = AsyncMock(return_value=(True, "dispatched"))

    async def _resolve_ws(db, subject):
        return ("ws-1", "notetaker@verdant-test.com")

    async def _resolve_uri(db, ws, parsed):
        return MEET_URI

    monkeypatch.setattr(svc, "_resolve_workspace_for_subject", _resolve_ws)
    monkeypatch.setattr(svc, "_resolve_meeting_uri", _resolve_uri)
    return svc, dispatch_mock


@pytest.mark.asyncio
async def test_handle_event_dispatches_once(patched_dispatch):
    svc, dispatch_mock = patched_dispatch
    db = _CaptureDb()

    record = MagicMock(id="m-1", is_duplicate=False)
    meeting_service = MagicMock()
    meeting_service.create_meeting = AsyncMock(return_value=record)

    with (
        patch("src.services.meet_events_service.get_db_connection",
              new=AsyncMock(return_value=db)),
        patch("src.services.meeting_service.MeetingService",
              return_value=meeting_service),
        patch("src.main.dispatch_meeting", new=dispatch_mock),
        patch("src.main.get_queue_service", new=AsyncMock(return_value=MagicMock())),
        # permissive policy
        patch("src.services.meet_events_service.OrgMeetingPolicyRepo") as Pol,
    ):
        Pol.return_value.evaluate = AsyncMock(
            return_value=MagicMock(allowed=True, reason="ok")
        )
        out = await svc.handle_conference_event(parse_conference_event(_cloud_event()))

    assert out["status"] == "dispatched"
    dispatch_mock.assert_awaited_once()
    assert dispatch_mock.await_args.kwargs["meeting_url"] == MEET_URI
    assert (
        dispatch_mock.await_args.kwargs["notetaker_email"]
        == "notetaker@verdant-test.com"
    )


@pytest.mark.asyncio
async def test_handle_event_dedupes_duplicate_delivery(patched_dispatch):
    svc, dispatch_mock = patched_dispatch
    db = _CaptureDb()
    record = MagicMock(id="m-1", is_duplicate=False)
    meeting_service = MagicMock()
    meeting_service.create_meeting = AsyncMock(return_value=record)

    parsed = parse_conference_event(_cloud_event())
    with (
        patch("src.services.meet_events_service.get_db_connection",
              new=AsyncMock(return_value=db)),
        patch("src.services.meeting_service.MeetingService",
              return_value=meeting_service),
        patch("src.main.dispatch_meeting", new=dispatch_mock),
        patch("src.main.get_queue_service", new=AsyncMock(return_value=MagicMock())),
        patch("src.services.meet_events_service.OrgMeetingPolicyRepo") as Pol,
    ):
        Pol.return_value.evaluate = AsyncMock(
            return_value=MagicMock(allowed=True, reason="ok")
        )
        first = await svc.handle_conference_event(parsed)
        second = await svc.handle_conference_event(parsed)  # duplicate delivery

    assert first["status"] == "dispatched"
    assert second["status"] == "duplicate"
    # Dispatch happened exactly once despite two deliveries.
    dispatch_mock.assert_awaited_once()


@pytest.mark.asyncio
async def test_handle_event_skips_when_policy_denies(patched_dispatch):
    svc, dispatch_mock = patched_dispatch
    db = _CaptureDb()
    with (
        patch("src.services.meet_events_service.get_db_connection",
              new=AsyncMock(return_value=db)),
        patch("src.main.dispatch_meeting", new=dispatch_mock),
        patch("src.services.meet_events_service.OrgMeetingPolicyRepo") as Pol,
    ):
        Pol.return_value.evaluate = AsyncMock(
            return_value=MagicMock(allowed=False, reason="denylisted")
        )
        out = await svc.handle_conference_event(
            parse_conference_event(_cloud_event())
        )
    assert out["status"] == "policy_skip"
    assert out["reason"] == "denylisted"
    dispatch_mock.assert_not_awaited()


# ── (d) policy unit tests ───────────────────────────────────────────────────


def test_policy_denylist_blocks_matching_domain():
    p = OrgMeetingPolicy(
        workspace_id="ws", mode=MODE_DENYLIST,
        deny={"domains": ["competitor.com"]}, allow={}, opt_out_emails=[],
    )
    assert p.evaluate(organizer_email="ceo@competitor.com").allowed is False
    assert p.evaluate(organizer_email="ceo@verdant.com").allowed is True


def test_policy_allowlist_only_admits_matches():
    p = OrgMeetingPolicy(
        workspace_id="ws", mode=MODE_ALLOWLIST,
        allow={"emails": ["vip@verdant.com"]}, deny={}, opt_out_emails=[],
    )
    assert p.evaluate(organizer_email="vip@verdant.com").allowed is True
    d = p.evaluate(organizer_email="other@verdant.com")
    assert d.allowed is False and d.reason == "not_in_allowlist"


def test_policy_opt_out_blocks_organizer():
    p = OrgMeetingPolicy(
        workspace_id="ws", mode="all",
        allow={}, deny={}, opt_out_emails=["shy@verdant.com"],
    )
    d = p.evaluate(organizer_email="shy@verdant.com")
    assert d.allowed is False and d.reason == "organizer_opted_out"


def test_policy_auto_join_disabled_blocks_all():
    p = OrgMeetingPolicy(
        workspace_id="ws", auto_join_enabled=False,
        allow={}, deny={}, opt_out_emails=[],
    )
    assert p.evaluate(organizer_email="anyone@verdant.com").allowed is False


# ── (e)(f)(g) webhook end-to-end ─────────────────────────────────────────────


@pytest.fixture
def webhook_client():
    from src.main import app

    return TestClient(app, raise_server_exceptions=False)


def test_webhook_rejects_bad_token(webhook_client, monkeypatch):
    from src.api.product import pubsub_verify as pv

    monkeypatch.setattr(pv.settings, "GOOGLE_PUBSUB_VERIFICATION_TOKEN", "s3cret")
    monkeypatch.setattr(pv.settings, "GOOGLE_PUBSUB_OIDC_AUDIENCE", None)

    res = webhook_client.post(
        "/api/v1/google/pubsub/push?token=wrong",
        json=_pubsub_envelope(_cloud_event()),
    )
    assert res.status_code == 401

    # Missing token entirely also rejected.
    res = webhook_client.post(
        "/api/v1/google/pubsub/push", json=_pubsub_envelope(_cloud_event())
    )
    assert res.status_code == 401


def test_webhook_unconfigured_acks_and_ignores(webhook_client, monkeypatch):
    from src.api.product import pubsub_verify as pv

    # No verification configured at all -> ack-and-ignore (202), no dispatch.
    monkeypatch.setattr(pv.settings, "GOOGLE_PUBSUB_VERIFICATION_TOKEN", None)
    monkeypatch.setattr(pv.settings, "GOOGLE_PUBSUB_OIDC_AUDIENCE", None)

    res = webhook_client.post(
        "/api/v1/google/pubsub/push", json=_pubsub_envelope(_cloud_event())
    )
    assert res.status_code == 202


def test_webhook_end_to_end_dispatches(webhook_client, monkeypatch):
    """Realistic Pub/Sub envelope -> verified -> decoded -> dispatch (mocked)."""
    from src.api.product import pubsub_verify as pv
    from src.api.product import routes_pubsub as rp

    monkeypatch.setattr(pv.settings, "GOOGLE_PUBSUB_VERIFICATION_TOKEN", "s3cret")
    monkeypatch.setattr(pv.settings, "GOOGLE_PUBSUB_OIDC_AUDIENCE", None)
    monkeypatch.setattr(rp.settings, "GOOGLE_WORKSPACE_ENABLED", True)

    process_mock = AsyncMock()
    monkeypatch.setattr(rp.MeetEventsService, "handle_conference_event", process_mock)

    res = webhook_client.post(
        "/api/v1/google/pubsub/push?token=s3cret",
        json=_pubsub_envelope(_cloud_event()),
    )
    assert res.status_code == 202
    # Background task ran the handler with the parsed conference event.
    process_mock.assert_awaited_once()
    parsed = process_mock.await_args.args[0]
    assert parsed["conference_id"] == CONFERENCE_ID


def test_webhook_acks_unknown_event(webhook_client, monkeypatch):
    from src.api.product import pubsub_verify as pv
    from src.api.product import routes_pubsub as rp

    monkeypatch.setattr(pv.settings, "GOOGLE_PUBSUB_VERIFICATION_TOKEN", "s3cret")
    monkeypatch.setattr(pv.settings, "GOOGLE_PUBSUB_OIDC_AUDIENCE", None)
    monkeypatch.setattr(rp.settings, "GOOGLE_WORKSPACE_ENABLED", True)

    process_mock = AsyncMock()
    monkeypatch.setattr(rp.MeetEventsService, "handle_conference_event", process_mock)

    unknown = {"type": "google.workspace.drive.file.v1.created", "data": {}}
    res = webhook_client.post(
        "/api/v1/google/pubsub/push?token=s3cret", json=_pubsub_envelope(unknown)
    )
    assert res.status_code == 202
    process_mock.assert_not_awaited()


# ── (f) subscribe route gating ───────────────────────────────────────────────


@pytest.fixture
def gw_subscribe_client():
    """POST /events/subscribe is admin-gated (require_role("admin"), which
    resolves via get_current_context) — override that, not the now-bypassed
    get_current_workspace, so the fake admin identity actually reaches the
    route."""
    from src.main import app
    from src.api.product.deps import AuthContext, get_current_context
    from src.api.product.schemas import Workspace

    app.dependency_overrides[get_current_context] = lambda: AuthContext(
        user=None,
        workspace=Workspace(
            id="00000000-0000-0000-0000-000000000001", name="W", slug="w", role="admin"
        ),
        via_api_key=False,
    )
    try:
        yield TestClient(app, raise_server_exceptions=False)
    finally:
        app.dependency_overrides.pop(get_current_context, None)


def test_subscribe_route_400_when_pubsub_unconfigured(gw_subscribe_client, monkeypatch):
    from src.services import meet_events_service as mes

    monkeypatch.setattr(mes.settings, "GOOGLE_PUBSUB_TOPIC", None)
    res = gw_subscribe_client.post("/api/v1/google-workspace/events/subscribe")
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "pubsub_not_configured"


def test_subscribe_route_400_when_workspace_unconfigured(
    gw_subscribe_client, monkeypatch
):
    from src.services import meet_events_service as mes

    monkeypatch.setattr(mes.settings, "GOOGLE_PUBSUB_TOPIC", "projects/p/topics/t")
    # No org configured -> get_auth_config returns None.
    db = MagicMock()
    db._driver = "pg"
    db.store = MagicMock()
    db.store.query_raw = AsyncMock(return_value=[])
    with patch.object(mes, "get_db_connection", new=AsyncMock(return_value=db)):
        res = gw_subscribe_client.post("/api/v1/google-workspace/events/subscribe")
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "google_workspace_not_configured"
