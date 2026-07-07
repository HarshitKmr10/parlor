"""Unit tests for Notion/HubSpot/Salesforce providers (pure parts)."""

import pytest

from src.integrations.crm_providers import (
    HubspotProvider,
    NotionProvider,
    SalesforceProvider,
    hubspot_payload,
    notion_payload,
    salesforce_payload,
    validate_salesforce_instance_url,
)
from src.integrations.models import MeetingRecap
from src.webhooks.safety import InvalidWebhookUrl

RECAP = MeetingRecap(
    meeting_id="m1",
    title="Q3 Planning",
    summary="We aligned on the roadmap.",
    key_points=["Billing first", "Then analytics"],
    action_items=["Bob owns cutover", "Carol owns dashboard"],
)


def test_notion_is_configured():
    p = NotionProvider()
    assert p.is_configured({"token": "secret", "databaseId": "db1"}) is True
    assert p.is_configured({"token": "secret"}) is False
    assert p.is_configured({}) is False


def test_notion_payload_structure():
    payload = notion_payload(RECAP, "db1")
    assert payload["parent"]["database_id"] == "db1"
    assert payload["properties"]["Name"]["title"][0]["text"]["content"] == "Q3 Planning"
    types = [b["type"] for b in payload["children"]]
    assert "paragraph" in types
    assert types.count("bulleted_list_item") == 2
    assert types.count("to_do") == 2


def test_hubspot_is_configured_and_payload():
    p = HubspotProvider()
    assert p.is_configured({"accessToken": "tok"}) is True
    assert p.is_configured({}) is False
    payload = hubspot_payload(RECAP, 1_700_000_000_000)
    assert payload["properties"]["hs_timestamp"] == 1_700_000_000_000
    assert "roadmap" in payload["properties"]["hs_note_body"]


def test_salesforce_is_configured_and_payload():
    p = SalesforceProvider()
    assert p.is_configured({"instanceUrl": "https://x.my.salesforce.com", "accessToken": "t"}) is True
    assert p.is_configured({"accessToken": "t"}) is False
    payload = salesforce_payload(RECAP)
    assert payload["Subject"].startswith("Meeting recap: Q3 Planning")
    assert payload["Status"] == "Completed"
    assert "roadmap" in payload["Description"]


@pytest.mark.parametrize(
    "url",
    [
        "http://127.0.0.1",
        "https://169.254.169.254",
        "http://x.my.salesforce.com",  # not https
        "https://evil.com",
        "https://x.my.salesforce.com.evil.com",
    ],
)
def test_salesforce_instance_url_rejects_unsafe_or_non_salesforce_hosts(url):
    with pytest.raises(InvalidWebhookUrl):
        validate_salesforce_instance_url(url)


def test_salesforce_instance_url_accepts_valid_salesforce_host():
    url = "https://foo.my.salesforce.com"
    assert validate_salesforce_instance_url(url) == url


@pytest.mark.asyncio
async def test_salesforce_deliver_rejects_unsafe_instance_url():
    p = SalesforceProvider()
    result = await p.deliver(
        {"instanceUrl": "http://169.254.169.254", "accessToken": "t"}, RECAP
    )
    assert result.delivered is False
