"""HTTP client for the internal ai-service (/summarize, /chat).

If the ai-service is unreachable, raises :class:`ApiError` (503) so the route
surfaces a clear error envelope instead of crashing.
"""

from __future__ import annotations

from typing import Any

import httpx

from shared.config import settings

from .errors import ApiError

_TIMEOUT = httpx.Timeout(60.0, connect=5.0)


async def _post(path: str, payload: dict[str, Any]) -> dict[str, Any]:
    url = f"{settings.AI_SERVICE_URL.rstrip('/')}{path}"
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.post(url, json=payload)
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


async def summarize(payload: dict[str, Any]) -> dict[str, Any]:
    return await _post("/summarize", payload)


async def chat(payload: dict[str, Any]) -> dict[str, Any]:
    return await _post("/chat", payload)
