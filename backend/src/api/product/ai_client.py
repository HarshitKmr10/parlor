"""HTTP client for the internal ai-service (/summarize, /chat).

If the ai-service is unreachable, raises :class:`ApiError` (503) so the route
surfaces a clear error envelope instead of crashing.
"""

from __future__ import annotations

import json
from datetime import date, datetime
from typing import Any

import httpx

from shared.config import settings

from .errors import ApiError

_TIMEOUT = httpx.Timeout(60.0, connect=5.0)

# /assist backs live in-call suggestions: a caller polling every few seconds
# during an active meeting must never block for the full batch timeout above.
# A slow/unreachable ai-service should degrade to "no suggestion this cycle"
# well within one polling interval instead of stalling the request.
_ASSIST_TIMEOUT = httpx.Timeout(5.0, connect=3.0)


def _json_default(obj: Any) -> str:
    """Encode types the stdlib json encoder rejects (e.g. transcript segment
    ``createdAt`` datetimes) as ISO-8601 strings so the ai-service payload
    serializes cleanly."""
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    raise TypeError(f"Object of type {type(obj).__name__} is not JSON serializable")


async def _post(
    path: str,
    payload: dict[str, Any],
    *,
    timeout: httpx.Timeout | None = None,
) -> dict[str, Any]:
    url = f"{settings.AI_SERVICE_URL.rstrip('/')}{path}"
    body = json.dumps(payload, default=_json_default).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if settings.AI_SERVICE_INTERNAL_TOKEN:
        headers["X-Internal-Service-Token"] = settings.AI_SERVICE_INTERNAL_TOKEN
    try:
        async with httpx.AsyncClient(timeout=timeout or _TIMEOUT) as client:
            resp = await client.post(url, content=body, headers=headers)
    except (httpx.ConnectError, httpx.ConnectTimeout, httpx.ReadTimeout) as exc:
        raise ApiError(
            503,
            "ai_service_unavailable",
            "The AI service is unreachable. Try again shortly.",
            details={"target": url, "reason": str(exc)},
        )
    except httpx.HTTPError as exc:
        raise ApiError(
            502,
            "ai_service_error",
            "The AI service returned an unexpected error.",
            details={"target": url, "reason": str(exc)},
        )

    if resp.status_code >= 400:
        raise ApiError(
            502,
            "ai_service_error",
            "The AI service rejected the request.",
            details={"status": resp.status_code, "body": resp.text[:500]},
        )
    try:
        return resp.json()
    except ValueError:
        raise ApiError(
            502, "ai_service_error", "The AI service returned a non-JSON body"
        )


async def embed(payload: dict[str, Any]) -> dict[str, Any]:
    return await _post("/embed", payload)


async def summarize(payload: dict[str, Any]) -> dict[str, Any]:
    return await _post("/summarize", payload)


async def chat(payload: dict[str, Any]) -> dict[str, Any]:
    return await _post("/chat", payload)


async def assist(payload: dict[str, Any]) -> dict[str, Any]:
    return await _post("/assist", payload, timeout=_ASSIST_TIMEOUT)
