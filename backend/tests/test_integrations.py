"""Tests for the outbound integrations module."""

from unittest.mock import AsyncMock, patch

import pytest

from src.integrations import KNOWN_KINDS, PROVIDERS, deliver_recap
from src.integrations.email_provider import EmailProvider
from src.integrations.models import MeetingRecap
from src.integrations.slack_provider import SlackProvider
from src.integrations.stub_providers import HubspotProvider, NotionProvider


def _recap():
    return MeetingRecap(
        meeting_id="m-1",
        title="Weekly sync",
        summary="We shipped the thing.",
        key_points=["Point A", "Point B"],
        action_items=["Alice to follow up"],
    )


def test_registry_has_all_kinds():
    assert set(KNOWN_KINDS) == {"slack", "email", "notion", "hubspot", "salesforce"}


def test_slack_is_configured_requires_webhook():
    p = SlackProvider()
    assert p.is_configured({"webhookUrl": "https://hooks.slack.com/services/x"}) is True
    assert p.is_configured({"webhookUrl": "https://evil.example.com"}) is False
    assert p.is_configured({}) is False


@pytest.mark.asyncio
async def test_slack_delivers_to_webhook():
    p = SlackProvider()
    resp = AsyncMock()
    resp.status_code = 200
    client = AsyncMock()
    client.post = AsyncMock(return_value=resp)
    client.__aenter__ = AsyncMock(return_value=client)
    client.__aexit__ = AsyncMock(return_value=False)

    with patch("httpx.AsyncClient", return_value=client):
        result = await p.deliver(
            {"webhookUrl": "https://hooks.slack.com/services/x"}, _recap()
        )
    assert result.delivered is True
    client.post.assert_awaited_once()


@pytest.mark.asyncio
async def test_email_logs_when_smtp_unset(monkeypatch):
    from src.integrations import email_provider as ep

    monkeypatch.setattr(ep.settings, "SMTP_HOST", None)
    p = EmailProvider()
    result = await p.deliver({"to": ["a@example.com"]}, _recap())
    assert result.delivered is True
    assert "logged" in (result.detail or "")


@pytest.mark.asyncio
async def test_email_no_recipients_not_delivered():
    p = EmailProvider()
    result = await p.deliver({}, _recap())
    assert result.delivered is False


@pytest.mark.asyncio
async def test_stub_providers_report_not_implemented():
    for provider in (NotionProvider(), HubspotProvider()):
        result = await provider.deliver({}, _recap())
        assert result.delivered is False
        assert "not yet implemented" in (result.detail or "")


# ── RBAC: /api/v1/integrations is admin-only (credentials live in config) ──


def _override_context(role: str):
    from src.api.product.deps import AuthContext
    from src.api.product.schemas import Workspace

    def _dep():
        return AuthContext(
            user=None,
            workspace=Workspace(
                id="00000000-0000-0000-0000-000000000002",
                name="W",
                slug="w",
                role=role,
            ),
            via_api_key=False,
        )

    return _dep


@pytest.fixture
def integrations_client_factory():
    """Yields a factory building a TestClient for a given caller role, with
    get_current_context + the route's IntegrationsRepo dependency overridden
    so no real DB is touched."""
    from fastapi.testclient import TestClient

    from src.api.product import routes_integrations
    from src.api.product.deps import get_current_context
    from src.main import app

    fake_repo = AsyncMock()
    fake_repo.list_for_workspace.return_value = []
    fake_repo.upsert.return_value = {
        "kind": "slack",
        "config": {"webhookUrl": "https://hooks.slack.com/services/x"},
        "enabled": True,
    }

    def _make(role: str):
        app.dependency_overrides[get_current_context] = _override_context(role)
        app.dependency_overrides[routes_integrations._repo] = lambda: fake_repo
        return TestClient(app), fake_repo

    try:
        yield _make
    finally:
        app.dependency_overrides.pop(get_current_context, None)
        app.dependency_overrides.pop(routes_integrations._repo, None)


def test_list_integrations_requires_admin_role(integrations_client_factory):
    client, fake_repo = integrations_client_factory("member")
    res = client.get("/api/v1/integrations")
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "insufficient_role"
    fake_repo.list_for_workspace.assert_not_awaited()


def test_list_integrations_allows_admin_role(integrations_client_factory):
    client, fake_repo = integrations_client_factory("admin")
    res = client.get("/api/v1/integrations")
    assert res.status_code == 200
    fake_repo.list_for_workspace.assert_awaited_once()


def test_upsert_integration_requires_admin_role(integrations_client_factory):
    client, fake_repo = integrations_client_factory("member")
    res = client.put(
        "/api/v1/integrations",
        json={
            "kind": "slack",
            "enabled": True,
            "config": {"webhookUrl": "https://hooks.slack.com/services/x"},
        },
    )
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "insufficient_role"
    fake_repo.upsert.assert_not_awaited()


def test_upsert_integration_allows_admin_role(integrations_client_factory):
    client, fake_repo = integrations_client_factory("admin")
    res = client.put(
        "/api/v1/integrations",
        json={
            "kind": "slack",
            "enabled": True,
            "config": {"webhookUrl": "https://hooks.slack.com/services/x"},
        },
    )
    assert res.status_code == 200, res.text
    fake_repo.upsert.assert_awaited_once()


def test_upsert_salesforce_rejects_private_ip_instance_url(integrations_client_factory):
    client, fake_repo = integrations_client_factory("admin")
    res = client.put(
        "/api/v1/integrations",
        json={
            "kind": "salesforce",
            "enabled": True,
            "config": {"instanceUrl": "http://169.254.169.254", "accessToken": "t"},
        },
    )
    assert res.status_code == 400, res.text
    assert res.json()["error"]["code"] == "invalid_instance_url"
    fake_repo.upsert.assert_not_awaited()


def test_upsert_salesforce_rejects_non_salesforce_host(integrations_client_factory):
    client, fake_repo = integrations_client_factory("admin")
    res = client.put(
        "/api/v1/integrations",
        json={
            "kind": "salesforce",
            "enabled": True,
            "config": {"instanceUrl": "https://evil.com", "accessToken": "t"},
        },
    )
    assert res.status_code == 400, res.text
    assert res.json()["error"]["code"] == "invalid_instance_url"
    fake_repo.upsert.assert_not_awaited()


def test_upsert_salesforce_accepts_valid_instance_url(integrations_client_factory):
    client, fake_repo = integrations_client_factory("admin")
    fake_repo.upsert.return_value = {
        "kind": "salesforce",
        "config": {"instanceUrl": "https://foo.my.salesforce.com", "accessToken": "t"},
        "enabled": True,
    }
    res = client.put(
        "/api/v1/integrations",
        json={
            "kind": "salesforce",
            "enabled": True,
            "config": {"instanceUrl": "https://foo.my.salesforce.com", "accessToken": "t"},
        },
    )
    assert res.status_code == 200, res.text
    fake_repo.upsert.assert_awaited_once()


@pytest.mark.asyncio
async def test_deliver_recap_only_enabled_and_configured():
    db = AsyncMock()
    db.store.query_raw = AsyncMock(
        return_value=[
            {
                "kind": "slack",
                "enabled": True,
                "config": {"webhookUrl": "https://hooks.slack.com/services/x"},
            },
            {"kind": "email", "enabled": False, "config": {"to": ["a@b.com"]}},
            {"kind": "notion", "enabled": True, "config": {}},
        ]
    )

    with patch.object(
        PROVIDERS["slack"], "deliver", AsyncMock()
    ) as slack_deliver:
        from src.integrations.models import DeliveryResult

        slack_deliver.return_value = DeliveryResult(kind="slack", delivered=True)
        results = await deliver_recap(db, "ws-1", _recap())

    kinds = {r.kind: r for r in results}
    # slack delivered; email skipped (disabled, not in results); notion not configured.
    assert kinds["slack"].delivered is True
    assert "email" not in kinds  # disabled rows are skipped entirely
    assert kinds["notion"].delivered is False
