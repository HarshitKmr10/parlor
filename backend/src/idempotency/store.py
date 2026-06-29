"""Idempotency stores: in-memory (tests) and Postgres-backed (prod).

Both implement the same async contract:

* ``reserve(key_hash, method, path)`` → :class:`Reservation` — claim the key, or
  report that it is already in-flight (``pending``) or completed (``done``).
* ``complete(key_hash, status_code, body)`` — store the final response.
* ``release(key_hash)`` — drop a claim (used when the handler 5xx'd / raised).
"""

from __future__ import annotations

import time
from typing import Dict, NamedTuple, Optional, Tuple

_TTL_SECONDS = 24 * 3600


class Reservation(NamedTuple):
    # state: "owned" (we claimed it, proceed) | "pending" (in-flight elsewhere)
    #        | "done" (replay the stored response)
    state: str
    status_code: Optional[int] = None
    body: Optional[bytes] = None


# ── in-memory (single process / tests) ──────────────────────────────────────


class InMemoryIdempotencyStore:
    def __init__(self, *, clock=None) -> None:
        self._rows: Dict[str, Tuple[str, Optional[int], Optional[bytes], float]] = {}
        self._clock = clock or time.monotonic

    async def reserve(self, key_hash: str, method: str, path: str) -> Reservation:
        now = self._clock()
        row = self._rows.get(key_hash)
        if row is not None and row[3] <= now:
            row = None  # expired
        if row is None:
            self._rows[key_hash] = ("pending", None, None, now + _TTL_SECONDS)
            return Reservation("owned")
        state, status, body, _ = row
        if state == "done":
            return Reservation("done", status, body)
        return Reservation("pending")

    async def complete(self, key_hash: str, status_code: int, body: bytes) -> None:
        exp = self._clock() + _TTL_SECONDS
        self._rows[key_hash] = ("done", status_code, body, exp)

    async def release(self, key_hash: str) -> None:
        self._rows.pop(key_hash, None)


# ── Postgres-backed (multi-replica / durable) ───────────────────────────────


class DbIdempotencyStore:
    def __init__(self, db) -> None:
        self._db = db

    async def reserve(self, key_hash: str, method: str, path: str) -> Reservation:
        # Clear any stale row, then try to claim atomically.
        await self._db.store.query_raw(
            "DELETE FROM idempotency_keys WHERE key_hash = $1 AND expires_at <= NOW()",
            key_hash,
        )
        claimed = await self._db.store.query_raw(
            """
            INSERT INTO idempotency_keys (key_hash, method, path, state, expires_at)
            VALUES ($1, $2, $3, 'pending', NOW() + INTERVAL '24 hours')
            ON CONFLICT (key_hash) DO NOTHING
            RETURNING key_hash
            """,
            key_hash,
            method,
            path,
        )
        if claimed:
            return Reservation("owned")

        rows = await self._db.store.query_raw(
            "SELECT state, status_code, response_body FROM idempotency_keys "
            "WHERE key_hash = $1",
            key_hash,
        )
        if not rows:  # raced with an expiry/delete — treat as owned
            return Reservation("owned")
        rec = rows[0]
        if rec.get("state") == "done":
            body = rec.get("response_body")
            return Reservation(
                "done",
                rec.get("status_code"),
                bytes(body) if body is not None else b"",
            )
        return Reservation("pending")

    async def complete(self, key_hash: str, status_code: int, body: bytes) -> None:
        await self._db.store.query_raw(
            "UPDATE idempotency_keys SET state = 'done', status_code = $2, "
            "response_body = $3 WHERE key_hash = $1 AND state = 'pending'",
            key_hash,
            status_code,
            body,
        )

    async def release(self, key_hash: str) -> None:
        await self._db.store.query_raw(
            "DELETE FROM idempotency_keys WHERE key_hash = $1 AND state = 'pending'",
            key_hash,
        )
