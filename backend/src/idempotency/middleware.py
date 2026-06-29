"""Idempotency middleware: replay cached responses for retried POSTs.

Opt-in per request (only acts when an ``Idempotency-Key`` header is present on a
POST). The first request executes and its response is captured; a retry with the
same key replays it with ``X-Idempotent-Replay: true``. A concurrent in-flight
retry gets 409. Best-effort: any store/DB failure falls through to normal
handling so idempotency infra can never take the API down.
"""

from __future__ import annotations

from typing import Optional

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from ..observability import get_logger
from ..ratelimit.keys import principal_key
from .keys import idempotency_key_hash

logger = get_logger(__name__)

_HEADER = "idempotency-key"
_MAX_KEY_LEN = 255
_REPLAYABLE_MAX_STATUS = 500  # cache <500 responses; 5xx releases the key


class IdempotencyMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, store=None) -> None:
        super().__init__(app)
        self._store = store  # injectable; defaults to a DB store per-request

    async def _get_store(self):
        if self._store is not None:
            return self._store
        from ..api.database.connection import get_db_connection  # noqa: PLC0415
        from .store import DbIdempotencyStore

        return DbIdempotencyStore(await get_db_connection())

    async def dispatch(self, request: Request, call_next):
        idem_key = request.headers.get(_HEADER)
        if request.method != "POST" or not idem_key:
            return await call_next(request)
        if len(idem_key) > _MAX_KEY_LEN:
            return JSONResponse(
                status_code=400,
                content={
                    "error": {
                        "code": "invalid_idempotency_key",
                        "message": "Idempotency-Key too long",
                    }
                },
            )

        principal = principal_key(
            api_key=request.headers.get("x-api-key"),
            authorization=request.headers.get("authorization"),
            client_host=request.client.host if request.client else None,
        )
        key_hash = idempotency_key_hash(
            principal=principal,
            method=request.method,
            path=request.url.path,
            idem_key=idem_key,
        )

        try:
            store = await self._get_store()
            reservation = await store.reserve(
                key_hash, request.method, request.url.path
            )
        except Exception as exc:  # noqa: BLE001 — never block on idempotency infra
            logger.warning("idempotency.reserve_failed", error=str(exc))
            return await call_next(request)

        if reservation.state == "done":
            return Response(
                content=reservation.body or b"",
                status_code=reservation.status_code or 200,
                media_type="application/json",
                headers={"X-Idempotent-Replay": "true"},
            )
        if reservation.state == "pending":
            return JSONResponse(
                status_code=409,
                content={
                    "error": {
                        "code": "idempotency_conflict",
                        "message": "A request with this Idempotency-Key is in progress",
                    }
                },
            )

        # state == "owned": execute and capture the response body.
        response = await call_next(request)
        body = b"".join([chunk async for chunk in response.body_iterator])

        try:
            if response.status_code < _REPLAYABLE_MAX_STATUS:
                await store.complete(key_hash, response.status_code, body)
            else:
                await store.release(key_hash)
        except Exception as exc:  # noqa: BLE001
            logger.warning("idempotency.complete_failed", error=str(exc))

        return Response(
            content=body,
            status_code=response.status_code,
            headers=dict(response.headers),
            media_type=response.media_type,
        )
