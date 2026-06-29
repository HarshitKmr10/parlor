"""Unit + E2E tests for idempotency keys."""

import pytest
from starlette.applications import Starlette
from starlette.responses import JSONResponse
from starlette.routing import Route
from starlette.testclient import TestClient

from src.idempotency import InMemoryIdempotencyStore, idempotency_key_hash
from src.idempotency.middleware import IdempotencyMiddleware

# ── key hashing ─────────────────────────────────────────────────────────────


def test_hash_is_deterministic():
    a = idempotency_key_hash(principal="p", method="POST", path="/x", idem_key="k")
    b = idempotency_key_hash(principal="p", method="POST", path="/x", idem_key="k")
    assert a == b


def test_hash_scoped_by_principal_method_path():
    base = dict(principal="p", method="POST", path="/x", idem_key="k")
    h = idempotency_key_hash(**base)
    assert h != idempotency_key_hash(**{**base, "principal": "other"})
    assert h != idempotency_key_hash(**{**base, "path": "/y"})
    assert h != idempotency_key_hash(**{**base, "idem_key": "k2"})


# ── in-memory store ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_store_owned_then_pending_then_done():
    store = InMemoryIdempotencyStore()
    assert (await store.reserve("h", "POST", "/x")).state == "owned"
    # second reserve before completion → pending
    assert (await store.reserve("h", "POST", "/x")).state == "pending"
    await store.complete("h", 201, b'{"ok":true}')
    r = await store.reserve("h", "POST", "/x")
    assert r.state == "done" and r.status_code == 201 and r.body == b'{"ok":true}'


@pytest.mark.asyncio
async def test_store_release_allows_reclaim():
    store = InMemoryIdempotencyStore()
    await store.reserve("h", "POST", "/x")
    await store.release("h")
    assert (await store.reserve("h", "POST", "/x")).state == "owned"


@pytest.mark.asyncio
async def test_store_expiry_allows_reclaim():
    class Clock:
        t = 0.0

        def __call__(self):
            return self.t

    clock = Clock()
    store = InMemoryIdempotencyStore(clock=clock)
    await store.reserve("h", "POST", "/x")
    clock.t = 10**9  # far future, past TTL
    assert (await store.reserve("h", "POST", "/x")).state == "owned"


# ── middleware E2E ──────────────────────────────────────────────────────────


def _app(store):
    calls = {"n": 0}

    async def create(request):
        calls["n"] += 1
        return JSONResponse({"id": calls["n"]}, status_code=201)

    app = Starlette(routes=[Route("/things", create, methods=["POST"])])
    app.add_middleware(IdempotencyMiddleware, store=store)
    return app, calls


def test_replays_response_without_reexecuting():
    store = InMemoryIdempotencyStore()
    app, calls = _app(store)
    c = TestClient(app)
    h = {"Idempotency-Key": "abc"}
    r1 = c.post("/things", headers=h)
    r2 = c.post("/things", headers=h)
    assert r1.json() == {"id": 1}
    assert r2.json() == {"id": 1}  # replayed, not re-executed
    assert r2.headers.get("X-Idempotent-Replay") == "true"
    assert calls["n"] == 1  # handler ran once


def test_different_key_executes_again():
    store = InMemoryIdempotencyStore()
    app, calls = _app(store)
    c = TestClient(app)
    c.post("/things", headers={"Idempotency-Key": "k1"})
    c.post("/things", headers={"Idempotency-Key": "k2"})
    assert calls["n"] == 2


def test_no_key_passes_through():
    store = InMemoryIdempotencyStore()
    app, calls = _app(store)
    c = TestClient(app)
    c.post("/things")
    c.post("/things")
    assert calls["n"] == 2  # not deduped without a key


def test_oversized_key_rejected():
    store = InMemoryIdempotencyStore()
    app, _ = _app(store)
    c = TestClient(app)
    r = c.post("/things", headers={"Idempotency-Key": "x" * 300})
    assert r.status_code == 400
