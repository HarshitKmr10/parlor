"""Tests for org-wide Google Workspace capture (Round 3).

The google-api-python-client / google-auth layer is fully MOCKED — no live
creds, no network. We monkeypatch credential creation and the discovery
``build`` so a fake Directory ``users().list()`` and Calendar ``events().list()``
return canned data. Covers:

  (a) the auth factory picks DomainWideDelegationAuth for auth_mode='dwd'
  (b) the directory client returns the mocked user list (with pagination)
  (c) the org-wide sync dispatches via dispatch_meeting on a Meet event and
      skips when the meeting is already a duplicate / already booked
  (d) the routes round-trip config (POST -> GET shows enabled + fingerprint,
      never the SA JSON) and /users returns the mocked users
"""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from src.integrations.google_workspace.auth import (
    AUTH_MODE_DWD,
    AUTH_MODE_MARKETPLACE,
    DomainWideDelegationAuth,
    MarketplaceAppAuth,
    OrgAuthConfig,
    WorkspaceAuthError,
    get_workspace_auth,
)
from src.integrations.google_workspace.directory import DirectoryClient

_FAKE_SA_JSON = json.dumps(
    {
        "type": "service_account",
        "project_id": "parlor-test",
        "client_email": "bot@parlor-test.iam.gserviceaccount.com",
        "private_key_id": "abc123",
    }
)
MEET_URL = "https://meet.google.com/abc-defg-hij"


# ── (a) auth factory ───────────────────────────────────────────────────────


def _dwd_config():
    return OrgAuthConfig.from_service_account_json(
        _FAKE_SA_JSON,
        auth_mode=AUTH_MODE_DWD,
        delegated_admin_email="admin@parlor-test.com",
        domain="parlor-test.com",
    )


def test_factory_picks_dwd_for_dwd_mode():
    auth = get_workspace_auth(_dwd_config())
    assert isinstance(auth, DomainWideDelegationAuth)


def test_factory_picks_marketplace_for_marketplace_mode():
    cfg = OrgAuthConfig(auth_mode=AUTH_MODE_MARKETPLACE)
    auth = get_workspace_auth(cfg)
    assert isinstance(auth, MarketplaceAppAuth)


def test_factory_defaults_to_dwd():
    cfg = OrgAuthConfig.from_service_account_json(_FAKE_SA_JSON)
    assert cfg.auth_mode == AUTH_MODE_DWD
    assert isinstance(get_workspace_auth(cfg), DomainWideDelegationAuth)


def test_factory_rejects_unknown_mode():
    cfg = OrgAuthConfig(auth_mode="carrier-pigeon")
    with pytest.raises(WorkspaceAuthError):
        get_workspace_auth(cfg)


def test_marketplace_methods_raise_not_implemented():
    auth = MarketplaceAppAuth()
    with pytest.raises(NotImplementedError, match="marketplace auth not yet"):
        auth.get_user_credentials("u@x.com", ("scope",))
    with pytest.raises(NotImplementedError, match="marketplace auth not yet"):
        auth.get_admin_credentials(("scope",))


def test_dwd_impersonates_via_with_subject(monkeypatch):
    """get_user_credentials / get_admin_credentials call with_subject with the
    right principal — without ever touching real Google libs."""
    base_creds = MagicMock(name="base_creds")
    base_creds.with_subject = MagicMock(side_effect=lambda s: f"creds_as:{s}")
    factory = MagicMock(return_value=base_creds)

    auth = DomainWideDelegationAuth(
        service_account_info=json.loads(_FAKE_SA_JSON),
        delegated_admin_email="admin@parlor-test.com",
    )
    monkeypatch.setattr(auth, "_base_credentials", lambda scopes: factory(scopes))

    assert auth.get_user_credentials("alice@x.com", ("s",)) == "creds_as:alice@x.com"
    assert auth.get_admin_credentials(("s",)) == "creds_as:admin@parlor-test.com"


def test_dwd_admin_requires_delegated_admin():
    auth = DomainWideDelegationAuth(
        service_account_info=json.loads(_FAKE_SA_JSON),
        delegated_admin_email=None,
    )
    with pytest.raises(WorkspaceAuthError, match="delegated_admin_email"):
        auth.get_admin_credentials(("s",))


# ── (b) directory client (mocked Admin SDK) ─────────────────────────────────


def _fake_directory_service(pages):
    """Build a MagicMock mimicking the Admin SDK chain with pagination.

    ``pages`` is a list of response dicts; each ``list().execute()`` returns the
    next one in order.
    """
    service = MagicMock()
    users_api = service.users.return_value
    executes = [MagicMock(execute=MagicMock(return_value=p)) for p in pages]
    users_api.list.side_effect = executes
    return service


def test_directory_returns_mocked_users_with_pagination():
    auth = MagicMock()
    auth.get_admin_credentials.return_value = MagicMock()
    pages = [
        {
            "users": [
                {"primaryEmail": "alice@x.com"},
                {"primaryEmail": "bob@x.com", "suspended": False},
                {"primaryEmail": "ghost@x.com", "suspended": True},
            ],
            "nextPageToken": "page2",
        },
        {"users": [{"primaryEmail": "carol@x.com"}]},
    ]
    fake_service = _fake_directory_service(pages)

    client = DirectoryClient(auth)
    with patch("googleapiclient.discovery.build", return_value=fake_service):
        emails = client.list_active_user_emails(domain="x.com")

    # Suspended user filtered out; both pages followed.
    assert emails == ["alice@x.com", "bob@x.com", "carol@x.com"]
    assert fake_service.users.return_value.list.call_count == 2


# ── (c) org-wide calendar sync ───────────────────────────────────────────────


def _meet_event(event_id="evt-1"):
    return {"id": event_id, "hangoutLink": MEET_URL}


@pytest.fixture
def sync_db():
    db = MagicMock()
    db._driver = "not-pg"  # use unqualified table names
    db.store = MagicMock()
    db.store.query_raw = AsyncMock(return_value=[])  # _already_booked -> False
    return db


@pytest.mark.asyncio
async def test_sync_dispatches_meet_event(monkeypatch, sync_db):
    from src.services import workspace_calendar_sync as wcs

    sync = wcs.WorkspaceCalendarSync()

    # MeetingService.create_meeting -> a non-duplicate record.
    record = MagicMock()
    record.id = "m-123"
    record.is_duplicate = False
    meeting_service = MagicMock()
    meeting_service.create_meeting = AsyncMock(return_value=record)

    auth = MagicMock()
    dispatch_mock = AsyncMock(return_value=(True, "dispatched"))

    with (
        patch.object(wcs, "MeetingService", return_value=meeting_service),
        patch("src.main.dispatch_meeting", new=dispatch_mock),
        patch("src.main.get_queue_service", new=AsyncMock(return_value=MagicMock())),
    ):
        count = await _scan_user_with_events(
            sync, sync_db, auth, "alice@x.com", [_meet_event()]
        )

    assert count == 1
    dispatch_mock.assert_awaited_once()
    kwargs = dispatch_mock.await_args.kwargs
    assert kwargs["meeting_url"] == MEET_URL
    assert kwargs["platform"] == "googlemeet"
    assert kwargs["meeting_id"] == "m-123"


@pytest.mark.asyncio
async def test_sync_skips_duplicate(monkeypatch, sync_db):
    from src.services import workspace_calendar_sync as wcs

    sync = wcs.WorkspaceCalendarSync()
    record = MagicMock()
    record.id = "m-dup"
    record.is_duplicate = True  # already in an ongoing meeting at this URL
    meeting_service = MagicMock()
    meeting_service.create_meeting = AsyncMock(return_value=record)

    dispatch_mock = AsyncMock()
    with (
        patch.object(wcs, "MeetingService", return_value=meeting_service),
        patch("src.main.dispatch_meeting", new=dispatch_mock),
    ):
        count = await _scan_user_with_events(
            sync, sync_db, MagicMock(), "alice@x.com", [_meet_event()]
        )

    assert count == 0
    dispatch_mock.assert_not_awaited()


@pytest.mark.asyncio
async def test_sync_skips_already_booked(sync_db):
    """An event already present in meeting_joiner.calendar_event_id (e.g. from
    the per-user poller) is skipped — shared dedupe."""
    from src.services import workspace_calendar_sync as wcs

    sync = wcs.WorkspaceCalendarSync()
    # _already_booked -> True for this event.
    sync_db.store.query_raw = AsyncMock(return_value=[{"?column?": 1}])

    meeting_service = MagicMock()
    meeting_service.create_meeting = AsyncMock()
    dispatch_mock = AsyncMock()
    with (
        patch.object(wcs, "MeetingService", return_value=meeting_service),
        patch("src.main.dispatch_meeting", new=dispatch_mock),
    ):
        count = await _scan_user_with_events(
            sync, sync_db, MagicMock(), "alice@x.com", [_meet_event()]
        )

    assert count == 0
    meeting_service.create_meeting.assert_not_awaited()
    dispatch_mock.assert_not_awaited()


@pytest.mark.asyncio
async def test_sync_noops_when_disabled(monkeypatch):
    from src.services import workspace_calendar_sync as wcs

    monkeypatch.setattr(wcs.settings, "GOOGLE_WORKSPACE_ENABLED", False)
    sync = wcs.WorkspaceCalendarSync()
    with patch.object(wcs, "get_db_connection", new=AsyncMock()) as get_db:
        dispatched = await sync.scan_once()
    assert dispatched == 0
    get_db.assert_not_awaited()


async def _scan_user_with_events(sync, db, auth, email, events):
    """Run _scan_user with _fetch_user_events stubbed to canned events."""
    with patch.object(sync, "_fetch_user_events", new=AsyncMock(return_value=events)):
        return await sync._scan_user(db, "ws-1", auth, email)


# ── (d) routes round-trip ────────────────────────────────────────────────────


def _override_context(role: str):
    """Build a get_current_context override resolving to a fixed workspace
    with the given role. Every dependency in the tree that needs the
    principal (get_current_workspace, require_role("admin"), ...) shares this
    single override, since FastAPI resolves Depends(get_current_context) by
    callable identity regardless of which route/dependency asked for it."""
    from src.api.product.deps import AuthContext
    from src.api.product.schemas import Workspace

    def _dep():
        return AuthContext(
            user=None,
            workspace=Workspace(
                id="00000000-0000-0000-0000-000000000001",
                name="W",
                slug="w",
                role=role,
            ),
            via_api_key=False,
        )

    return _dep


@pytest.fixture
def gw_client():
    """TestClient with get_current_context + get_db overridden (admin role —
    every google-workspace route requires it), and a single in-memory
    google_workspace_orgs row simulated through the repo's SQL."""
    from src.main import app
    from src.api.product.deps import get_current_context, get_db

    state = {"row": None}  # the single stored config

    fake_db = _FakeWorkspaceDb(state)
    app.dependency_overrides[get_current_context] = _override_context("admin")
    app.dependency_overrides[get_db] = lambda: fake_db
    try:
        yield TestClient(app), state
    finally:
        app.dependency_overrides.pop(get_current_context, None)
        app.dependency_overrides.pop(get_db, None)


@pytest.fixture
def gw_member_client():
    """Same as gw_client but the caller is a plain 'member' — every endpoint
    gated by require_role("admin") must reject with 403."""
    from src.main import app
    from src.api.product.deps import get_current_context, get_db

    state = {"row": None}
    fake_db = _FakeWorkspaceDb(state)
    app.dependency_overrides[get_current_context] = _override_context("member")
    app.dependency_overrides[get_db] = lambda: fake_db
    try:
        yield TestClient(app), state
    finally:
        app.dependency_overrides.pop(get_current_context, None)
        app.dependency_overrides.pop(get_db, None)


class _FakeStore:
    """Minimal store implementing the SQL the repo issues, against one row."""

    def __init__(self, state):
        self._state = state

    async def query_raw(self, sql, *args):
        s = sql.strip()
        if s.startswith("INSERT INTO google_workspace_orgs"):
            (
                workspace_id,
                auth_mode,
                encrypted,
                admin,
                domain,
                customer_id,
                mkt_client,
                mkt_proj,
                notetaker_email,
                enabled,
            ) = args
            prev = self._state["row"] or {}
            # COALESCE: keep existing SA cipher if a NULL is passed.
            sa = (
                encrypted if encrypted is not None else prev.get("service_account_json")
            )
            self._state["row"] = {
                "id": "11111111-1111-1111-1111-111111111111",
                "workspace_id": workspace_id,
                "auth_mode": auth_mode,
                "service_account_json": sa,
                "delegated_admin_email": admin,
                "domain": domain,
                "customer_id": customer_id,
                "marketplace_client_id": mkt_client,
                "marketplace_project_number": mkt_proj,
                "notetaker_email": (
                    notetaker_email
                    if notetaker_email is not None
                    else prev.get("notetaker_email")
                ),
                "enabled": enabled,
                "created_at": "2026-06-16T00:00:00+00:00",
                "updated_at": "2026-06-16T00:00:00+00:00",
            }
            return [self._public_row()]
        if s.startswith("DELETE FROM google_workspace_orgs"):
            had = self._state["row"] is not None
            self._state["row"] = None
            return [{"id": "x"}] if had else []
        if "service_account_json" in s and s.startswith("SELECT service_account_json"):
            row = self._state["row"]
            return (
                [{"service_account_json": row["service_account_json"]}] if row else []
            )
        if s.startswith("SELECT auth_mode, service_account_json"):
            row = self._state["row"]
            if not row:
                return []
            return [
                {
                    "auth_mode": row["auth_mode"],
                    "service_account_json": row["service_account_json"],
                    "delegated_admin_email": row["delegated_admin_email"],
                    "domain": row["domain"],
                    "customer_id": row["customer_id"],
                    "marketplace_client_id": row["marketplace_client_id"],
                    "marketplace_project_number": row["marketplace_project_number"],
                }
            ]
        if s.startswith("SELECT id, workspace_id, domain"):  # get_public
            return [self._public_row()] if self._state["row"] else []
        raise AssertionError(f"unexpected SQL: {s[:60]}")

    def _public_row(self):
        row = dict(self._state["row"])
        row["has_service_account"] = row["service_account_json"] is not None
        row.pop("service_account_json", None)
        return row


class _FakeWorkspaceDb:
    def __init__(self, state):
        self.store = _FakeStore(state)
        self._driver = "pg"


def test_routes_not_configured_returns_400(gw_client):
    client, _ = gw_client
    res = client.get("/api/v1/google-workspace")
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "google_workspace_not_configured"

    res = client.get("/api/v1/google-workspace/users")
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "google_workspace_not_configured"


def test_routes_post_then_get_roundtrip_never_returns_sa_json(gw_client):
    client, _ = gw_client
    res = client.post(
        "/api/v1/google-workspace",
        json={
            "authMode": "dwd",
            "serviceAccountJson": _FAKE_SA_JSON,
            "delegatedAdminEmail": "admin@parlor-test.com",
            "domain": "parlor-test.com",
            "enabled": True,
        },
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["enabled"] is True
    assert body["hasServiceAccount"] is True
    assert body["serviceAccountFingerprint"]
    # The SA JSON must NEVER be serialized back.
    assert "serviceAccountJson" not in body
    assert _FAKE_SA_JSON not in res.text
    fingerprint = body["serviceAccountFingerprint"]

    res = client.get("/api/v1/google-workspace")
    assert res.status_code == 200
    got = res.json()
    assert got["enabled"] is True
    assert got["authMode"] == "dwd"
    assert got["delegatedAdminEmail"] == "admin@parlor-test.com"
    assert got["serviceAccountFingerprint"] == fingerprint
    assert "serviceAccountJson" not in got
    assert _FAKE_SA_JSON not in res.text


def test_routes_post_requires_sa_json_first_time(gw_client):
    client, _ = gw_client
    res = client.post(
        "/api/v1/google-workspace",
        json={"authMode": "dwd", "delegatedAdminEmail": "admin@x.com"},
    )
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "service_account_required"


def test_routes_users_returns_mocked_users(gw_client):
    client, _ = gw_client
    # Configure first.
    client.post(
        "/api/v1/google-workspace",
        json={
            "authMode": "dwd",
            "serviceAccountJson": _FAKE_SA_JSON,
            "delegatedAdminEmail": "admin@parlor-test.com",
            "domain": "parlor-test.com",
            "enabled": True,
        },
    )

    fake_service = _fake_directory_service(
        [{"users": [{"primaryEmail": "alice@x.com"}, {"primaryEmail": "bob@x.com"}]}]
    )
    # Mock both the credential minting and the discovery build so no real
    # google-auth runs against the fake SA JSON.
    with (
        patch(
            "src.integrations.google_workspace.auth.DomainWideDelegationAuth."
            "_base_credentials",
            return_value=MagicMock(with_subject=MagicMock(return_value=MagicMock())),
        ),
        patch("googleapiclient.discovery.build", return_value=fake_service),
    ):
        res = client.get("/api/v1/google-workspace/users")

    assert res.status_code == 200, res.text
    body = res.json()
    assert body["total"] == 2
    assert body["users"] == ["alice@x.com", "bob@x.com"]


def test_routes_delete(gw_client):
    client, _ = gw_client
    client.post(
        "/api/v1/google-workspace",
        json={
            "authMode": "dwd",
            "serviceAccountJson": _FAKE_SA_JSON,
            "delegatedAdminEmail": "admin@parlor-test.com",
            "enabled": True,
        },
    )
    res = client.delete("/api/v1/google-workspace")
    assert res.status_code == 200
    assert res.json()["deleted"] is True

    # Now it's gone.
    res = client.get("/api/v1/google-workspace")
    assert res.status_code == 400


# ── RBAC: every admin-configuration endpoint must reject non-admin members ──


def test_configure_requires_admin_role(gw_member_client):
    client, _ = gw_member_client
    res = client.post(
        "/api/v1/google-workspace",
        json={
            "authMode": "dwd",
            "serviceAccountJson": _FAKE_SA_JSON,
            "delegatedAdminEmail": "admin@verdant-test.com",
            "enabled": True,
        },
    )
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "insufficient_role"


def test_get_config_requires_admin_role(gw_member_client):
    client, _ = gw_member_client
    res = client.get("/api/v1/google-workspace")
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "insufficient_role"


def test_delete_config_requires_admin_role(gw_member_client):
    client, _ = gw_member_client
    res = client.delete("/api/v1/google-workspace")
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "insufficient_role"


def test_list_users_requires_admin_role(gw_member_client):
    client, _ = gw_member_client
    res = client.get("/api/v1/google-workspace/users")
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "insufficient_role"


def test_subscribe_events_requires_admin_role(gw_member_client):
    client, _ = gw_member_client
    res = client.post("/api/v1/google-workspace/events/subscribe")
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "insufficient_role"


def test_list_event_subscriptions_requires_admin_role(gw_member_client):
    client, _ = gw_member_client
    res = client.get("/api/v1/google-workspace/events/subscriptions")
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "insufficient_role"


def test_delete_event_subscriptions_requires_admin_role(gw_member_client):
    client, _ = gw_member_client
    res = client.delete("/api/v1/google-workspace/events/subscriptions")
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "insufficient_role"
