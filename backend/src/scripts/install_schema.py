#!/usr/bin/env python3
"""Install the standalone meeting-joiner database schema.

This script intentionally avoids the `psql` binary. It uses dependencies that
the meeting-joiner API/worker images already carry: asyncpg and pgqueuer.
"""

from __future__ import annotations

import argparse
import asyncio
import os
import re
import sys
from pathlib import Path
from typing import Iterable

SRC_ROOT = Path(__file__).resolve().parents[1]
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from db.python.dsn import normalize_postgres_dsn


ADVISORY_LOCK_KEY_1 = 525017
ADVISORY_LOCK_KEY_2 = 3583
IDENTIFIER_RE = re.compile(r"^[a-z_][a-z0-9_]*$")


def _schema_from_env(name: str, default: str) -> str:
    value = (os.getenv(name) or default).strip()
    if not IDENTIFIER_RE.fullmatch(value):
        raise ValueError(
            f"{name} must be a lowercase PostgreSQL identifier matching "
            "[a-z_][a-z0-9_]*"
        )
    return value


def _quote_identifier(identifier: str) -> str:
    if not IDENTIFIER_RE.fullmatch(identifier):
        raise ValueError(
            f"PostgreSQL identifier must match [a-z_][a-z0-9_]*: {identifier!r}"
        )
    return f'"{identifier}"'


def _qualified_name(schema: str, relation: str) -> str:
    return f"{_quote_identifier(schema)}.{_quote_identifier(relation)}"


def _normalise_postgres_dsn(dsn: str) -> str:
    return normalize_postgres_dsn(dsn)


def _default_bootstrap_candidates() -> Iterable[Path]:
    here = Path(__file__).resolve()
    yield here.parents[2] / "db" / "bootstrap.sql"
    yield Path("/app/db/bootstrap.sql")
    yield Path("/app/meeting-joiner/db/bootstrap.sql")


def _resolve_bootstrap_sql(explicit_path: str | None) -> Path:
    if explicit_path:
        path = Path(explicit_path).expanduser().resolve()
        if path.exists():
            return path
        raise FileNotFoundError(f"bootstrap SQL file not found: {path}")

    for candidate in _default_bootstrap_candidates():
        if candidate.exists():
            return candidate

    searched = ", ".join(str(path) for path in _default_bootstrap_candidates())
    raise FileNotFoundError(f"bootstrap.sql not found; searched: {searched}")


async def _relation_exists(conn, relation_name: str) -> bool:
    return bool(await conn.fetchval("SELECT to_regclass($1) IS NOT NULL", relation_name))


async def _install_bootstrap(conn, bootstrap_path: Path, schema: str) -> None:
    sql = bootstrap_path.read_text(encoding="utf-8")
    await conn.execute(f"CREATE SCHEMA IF NOT EXISTS {_quote_identifier(schema)}")
    await conn.execute(f"SET search_path TO {_quote_identifier(schema)}, pg_catalog")
    table_name = _qualified_name(schema, "meeting_joiner")

    print(f"Applying meeting-joiner bootstrap: {bootstrap_path} into {schema}")
    await conn.execute(sql)
    if not await _relation_exists(conn, table_name):
        raise RuntimeError(f"bootstrap completed but {table_name} was not found")
    print(f"meeting-joiner schema ready: {table_name}")


async def _install_pgqueuer(conn, schema: str) -> None:
    from pgqueuer.db import AsyncpgDriver
    from pgqueuer.queries import Queries

    await conn.execute(f"CREATE SCHEMA IF NOT EXISTS {_quote_identifier(schema)}")
    await conn.execute(f"SET search_path TO {_quote_identifier(schema)}, pg_catalog")
    table_name = _qualified_name(schema, "pgqueuer")
    queries = Queries(AsyncpgDriver(conn))

    if await _relation_exists(conn, table_name):
        print(f"PGQueuer schema already present: {table_name}")
        print(f"Upgrading PGQueuer schema: {schema}")
        await queries.upgrade()
        print(f"PGQueuer schema upgraded: {table_name}")
    else:
        print(f"Installing PGQueuer schema: {schema}")
        await queries.install()
        print(f"Upgrading PGQueuer schema: {schema}")
        await queries.upgrade()

    if not await _relation_exists(conn, table_name):
        raise RuntimeError(f"PGQueuer install completed but {table_name} was not found")
    print(f"PGQueuer schema ready: {table_name}")


async def _print_status(conn, meeting_schema: str, pgqueuer_schema: str) -> None:
    meeting_table = _qualified_name(meeting_schema, "meeting_joiner")
    pgqueuer_table = _qualified_name(pgqueuer_schema, "pgqueuer")
    meeting_ready = await _relation_exists(conn, meeting_table)
    pgqueuer_ready = await _relation_exists(conn, pgqueuer_table)
    print(f"{meeting_table}: {'present' if meeting_ready else 'missing'}")
    print(f"{pgqueuer_table}: {'present' if pgqueuer_ready else 'missing'}")


async def _run(args: argparse.Namespace) -> None:
    import asyncpg

    raw_dsn = os.getenv("DIRECT_URL") or os.getenv("DATABASE_URL")
    if not raw_dsn:
        raise RuntimeError("DIRECT_URL or DATABASE_URL must be set")

    bootstrap_path = (
        _resolve_bootstrap_sql(args.bootstrap_sql)
        if not args.status and not args.skip_meeting_joiner
        else None
    )
    meeting_schema = _schema_from_env("MEETING_JOINER_SCHEMA", "public")
    pgqueuer_schema = _schema_from_env("MEETING_JOINER_PGQUEUER_SCHEMA", "pgqueuer")
    dsn = _normalise_postgres_dsn(raw_dsn)
    conn = await asyncpg.connect(dsn, statement_cache_size=0)
    try:
        await conn.execute(
            "SELECT pg_advisory_lock($1::integer, $2::integer)",
            ADVISORY_LOCK_KEY_1,
            ADVISORY_LOCK_KEY_2,
        )
        try:
            if args.status:
                await _print_status(conn, meeting_schema, pgqueuer_schema)
                return
            if not args.skip_meeting_joiner:
                assert bootstrap_path is not None
                await _install_bootstrap(conn, bootstrap_path, meeting_schema)
            if not args.skip_pgqueuer:
                await _install_pgqueuer(conn, pgqueuer_schema)
            await _print_status(conn, meeting_schema, pgqueuer_schema)
        finally:
            await conn.execute(
                "SELECT pg_advisory_unlock($1::integer, $2::integer)",
                ADVISORY_LOCK_KEY_1,
                ADVISORY_LOCK_KEY_2,
            )
    finally:
        await conn.close()


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Install the standalone meeting-joiner table and PGQueuer schema "
            "using DIRECT_URL or DATABASE_URL."
        )
    )
    parser.add_argument(
        "--bootstrap-sql",
        help="Path to bootstrap.sql. Defaults to the bundled db/bootstrap.sql.",
    )
    parser.add_argument(
        "--skip-meeting-joiner",
        action="store_true",
        help="Do not apply db/bootstrap.sql.",
    )
    parser.add_argument(
        "--skip-pgqueuer",
        action="store_true",
        help="Do not install the pgqueuer schema.",
    )
    parser.add_argument(
        "--status",
        action="store_true",
        help="Only report whether the expected schema objects are present.",
    )
    return parser.parse_args()


def main() -> None:
    asyncio.run(_run(_parse_args()))


if __name__ == "__main__":
    main()
