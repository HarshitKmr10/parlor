"""Tests for POST /embed's error responses.

Uses FastAPI's TestClient against the real app (mirrors tests/test_draft.py's
approach of exercising failure branches via unittest.mock rather than a real
provider/DB) so these run without any LLM keys or a live Postgres/pgvector.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, PropertyMock, patch

from fastapi.testclient import TestClient

from app.main import app
from app.rag.store import EmbeddingStore

client = TestClient(app)

_URL = "/embed"


def _payload(**overrides) -> dict:
    payload = {
        "workspaceId": "ws1",
        "meetingId": "m1",
        "segments": [
            {
                "id": "s1",
                "speakerName": "Alice",
                "text": "hello world",
                "tStartSec": 0.0,
            }
        ],
    }
    payload.update(overrides)
    return payload


def test_embed_store_write_failure_returns_curated_message_not_raw_exception():
    """Regression: the store-write except branch must not forward the raw
    asyncpg exception string to the caller (it may contain connection
    details, credentials, or internal hostnames) -- it should log the raw
    error server-side and return a generic curated message, matching the
    ProviderError branches elsewhere in this route module."""
    raw_error = "connection to server at 10.0.0.5 failed: FATAL: password authentication failed for user \"meeting\""

    with (
        patch.object(EmbeddingStore, "ready", new_callable=PropertyMock, return_value=True),
        patch(
            "app.routes.insights.ProviderRouter.embed",
            new=AsyncMock(return_value=[[0.1, 0.2, 0.3]]),
        ),
        patch.object(
            EmbeddingStore,
            "upsert_segments",
            new=AsyncMock(side_effect=RuntimeError(raw_error)),
        ),
    ):
        response = client.post(_URL, json=_payload())

    assert response.status_code == 502
    body = response.json()
    assert body["error"]["code"] == "store_error"
    assert body["error"]["message"] == "Failed to persist embeddings."
    assert raw_error not in body["error"]["message"]
    assert "10.0.0.5" not in response.text
    assert "password authentication" not in response.text
