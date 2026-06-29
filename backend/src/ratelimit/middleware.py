"""FastAPI rate-limit middleware.

Applies a token-bucket limit per principal (API key / user / IP) with a stricter
tier for the unauthenticated public surface. Returns 429 with the product error
envelope + ``Retry-After`` when exceeded, and sets ``X-RateLimit-*`` headers on
every response. Health/readiness probes and CORS preflights are exempt.

Tunable via env (all optional):
  RATE_LIMIT_ENABLED        default "true"
  RATE_LIMIT_RPS / _BURST   default 10 / 60   (authenticated tier)
  RATE_LIMIT_PUBLIC_RPS / _BURST  default 2 / 20  (public tier)
"""

from __future__ import annotations

import math
import os
from typing import Tuple

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from ..observability import get_logger
from .keys import principal_key, tier_for_path
from .store import InMemoryTokenBucketStore

logger = get_logger(__name__)

_EXEMPT_PATHS = {"/health", "/ready", "/metrics", "/openapi.json", "/docs", "/redoc"}


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


def _enabled() -> bool:
    return (os.getenv("RATE_LIMIT_ENABLED", "true") or "").lower() not in (
        "0",
        "false",
        "no",
    )


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, store: InMemoryTokenBucketStore | None = None) -> None:
        super().__init__(app)
        self._store = store or InMemoryTokenBucketStore()
        self._enabled = _enabled()
        self._tiers = {
            "default": (
                _env_float("RATE_LIMIT_RPS", 10.0),
                _env_float("RATE_LIMIT_BURST", 60.0),
            ),
            "public": (
                _env_float("RATE_LIMIT_PUBLIC_RPS", 2.0),
                _env_float("RATE_LIMIT_PUBLIC_BURST", 20.0),
            ),
        }

    def _limits(self, path: str) -> Tuple[str, float, float]:
        tier = tier_for_path(path)
        rate, burst = self._tiers[tier]
        return tier, rate, burst

    async def dispatch(self, request: Request, call_next) -> Response:
        path = request.url.path
        if not self._enabled or request.method == "OPTIONS" or path in _EXEMPT_PATHS:
            return await call_next(request)

        tier, rate, burst = self._limits(path)
        key = (
            tier
            + ":"
            + principal_key(
                api_key=request.headers.get("x-api-key"),
                authorization=request.headers.get("authorization"),
                client_host=request.client.host if request.client else None,
            )
        )

        decision = await self._store.consume(key, rate=rate, capacity=burst)
        if not decision.allowed:
            retry_after = max(1, math.ceil(decision.retry_after))
            logger.info("ratelimit.blocked", tier=tier, path=path)
            return JSONResponse(
                status_code=429,
                content={
                    "error": {
                        "code": "rate_limited",
                        "message": "Rate limit exceeded. Slow down and retry.",
                    }
                },
                headers={
                    "Retry-After": str(retry_after),
                    "X-RateLimit-Limit": str(decision.limit),
                    "X-RateLimit-Remaining": "0",
                },
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(decision.limit)
        response.headers["X-RateLimit-Remaining"] = str(decision.remaining)
        return response
