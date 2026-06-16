import pytest

from src.api.database.connection import DatabaseConnection


class _FakeStore:
    def __init__(self):
        self.calls = []

    async def query_raw(self, sql, *params):
        self.calls.append((sql, params))
        return [{"id": params[0]}]


@pytest.mark.asyncio
async def test_validate_org_id_uses_configured_schema_for_pg(monkeypatch):
    monkeypatch.setenv("MEETING_JOINER_SCHEMA", "meeting_joiner")
    store = _FakeStore()
    db = DatabaseConnection.__new__(DatabaseConnection)
    db._driver = "pg"
    db.store = store

    assert await db._validate_org_id("org_123") == "org_123"

    sql, params = store.calls[0]
    assert sql == 'SELECT id FROM "meeting_joiner"."organizations" WHERE id = $1'
    assert params == ("org_123",)


@pytest.mark.asyncio
async def test_claim_for_rejoin_uses_configured_schema(monkeypatch):
    monkeypatch.setenv("MEETING_JOINER_SCHEMA", "meeting_joiner")
    store = _FakeStore()
    db = DatabaseConnection.__new__(DatabaseConnection)
    db._driver = "pg"
    db._connected = True
    db.store = store

    assert await db.claim_for_rejoin("00000000-0000-0000-0000-000000000001")

    sql, params = store.calls[0]
    assert 'UPDATE "meeting_joiner"."meeting_joiner"' in sql
    assert params == ("00000000-0000-0000-0000-000000000001",)


@pytest.mark.asyncio
async def test_claim_for_rejoin_keeps_legacy_prisma_table_name(monkeypatch):
    monkeypatch.setenv("MEETING_JOINER_SCHEMA", "meeting_joiner")
    store = _FakeStore()
    db = DatabaseConnection.__new__(DatabaseConnection)
    db._driver = "prisma"
    db._connected = True
    db.store = store

    assert await db.claim_for_rejoin("00000000-0000-0000-0000-000000000001")

    sql, params = store.calls[0]
    assert "UPDATE meeting_joiner" in sql
    assert '"meeting_joiner"."meeting_joiner"' not in sql
    assert params == ("00000000-0000-0000-0000-000000000001",)
