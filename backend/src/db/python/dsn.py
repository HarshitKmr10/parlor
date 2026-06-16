"""Postgres DSN helpers for asyncpg runtime paths."""

from __future__ import annotations

from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

_ASYNC_PG_UNSUPPORTED_QUERY_KEYS = {
    "connection_limit",
    "pgbouncer",
    "pool_timeout",
    "schema",
}


def normalize_postgres_dsn(dsn: str) -> str:
    """Return a DSN asyncpg can consume without Prisma/pooler-only params."""
    parsed = urlparse(dsn)
    scheme = "postgresql" if parsed.scheme == "postgresql+asyncpg" else parsed.scheme
    query = [
        (key, value)
        for key, value in parse_qsl(parsed.query, keep_blank_values=True)
        if key not in _ASYNC_PG_UNSUPPORTED_QUERY_KEYS
    ]
    return urlunparse(
        (
            scheme,
            parsed.netloc,
            parsed.path,
            parsed.params,
            urlencode(query),
            parsed.fragment,
        )
    )
