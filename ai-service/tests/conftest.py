"""Shared pytest configuration for ai-service.

Sets AI_SERVICE_INTERNAL_TOKEN in the environment *before* any test module
imports ``app.main``/``app.config`` (settings are resolved once at import
time via ``settings = load_settings()``), so the internal-auth dependency in
``app.main.require_internal_token`` doesn't fail closed with a 500 for every
test that exercises the real FastAPI app through TestClient.

``TEST_INTERNAL_TOKEN`` is exported so test modules that hit the app over
HTTP (rather than calling route/service functions directly) can attach the
matching ``X-Internal-Service-Token`` header.
"""

from __future__ import annotations

import os

TEST_INTERNAL_TOKEN = "test-internal-service-token"
os.environ.setdefault("AI_SERVICE_INTERNAL_TOKEN", TEST_INTERNAL_TOKEN)
