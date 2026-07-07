"""order_by whitelist for pg_store.list_meetings (defense against SQL injection
via string interpolation into ORDER BY)."""

import pytest

from src.db.python.pg_store import list_meetings


@pytest.mark.asyncio
async def test_list_meetings_rejects_unrecognized_order_by():
    with pytest.raises(ValueError):
        await list_meetings(order_by="created_at; DROP TABLE meeting_joiner")


@pytest.mark.asyncio
async def test_list_meetings_rejects_order_by_not_in_whitelist():
    with pytest.raises(ValueError):
        await list_meetings(order_by="title ASC")
