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
