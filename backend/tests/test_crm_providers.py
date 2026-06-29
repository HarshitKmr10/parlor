"""Unit tests for Notion/HubSpot/Salesforce providers (pure parts)."""

from src.integrations.crm_providers import (
    HubspotProvider,
    NotionProvider,
    SalesforceProvider,
    hubspot_payload,
    notion_payload,
    salesforce_payload,
)
from src.integrations.models import MeetingRecap

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
