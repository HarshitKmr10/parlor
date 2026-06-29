"""Idempotency keys for safe POST retries (Stripe/Recall semantics).

A client sends ``Idempotency-Key: <uuid>`` on a mutating request; the first call
executes and its response is cached (scoped per principal+method+path), and any
retry with the same key replays that response instead of re-executing — so a
network blip never double-creates a resource.

Public surface:
* :func:`idempotency_key_hash` — pure scoped key hash.
* :class:`InMemoryIdempotencyStore` / :class:`DbIdempotencyStore` — pluggable.
* :class:`IdempotencyMiddleware`.
"""

from __future__ import annotations

from .keys import idempotency_key_hash
from .store import DbIdempotencyStore, InMemoryIdempotencyStore, Reservation

__all__ = [
    "idempotency_key_hash",
    "InMemoryIdempotencyStore",
    "DbIdempotencyStore",
    "Reservation",
]
