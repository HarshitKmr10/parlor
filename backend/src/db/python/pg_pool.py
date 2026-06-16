"""Shared asyncpg pool for the raw-SQL adapter.

Configured for Supabase pgbouncer transaction-mode (port 6543):
* statement_cache_size=0 disables prepared-statement caching that pgbouncer
  can't preserve across transactions.
* application_name is set for observability.
* min_size=1, max_size=10 matches prior Prisma pool sizing.

The pool is created on first await and cached at module scope so callers
share one set of connections across the process.
"""

from __future__ import annotations

import os
from typing import Optional

import asyncpg

from .dsn import normalize_postgres_dsn

_pool: Optional[asyncpg.Pool] = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is not None:
        return _pool

    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        raise RuntimeError(
            "DATABASE_URL is not set; meeting-joiner pg_store cannot connect"
        )

    max_size = int(os.environ.get("MEETING_JOINER_PG_MAX", "10"))

    _pool = await asyncpg.create_pool(
        dsn=normalize_postgres_dsn(dsn),
        min_size=1,
        max_size=max_size,
        statement_cache_size=0,
        command_timeout=30,
        server_settings={"application_name": "meeting-joiner"},
    )
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool is None:
        return
    pool = _pool
    _pool = None
    await pool.close()
