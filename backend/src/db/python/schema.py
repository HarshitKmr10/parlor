"""Schema configuration for the raw Postgres meeting-joiner path."""

from __future__ import annotations

import os
import re

_IDENTIFIER_RE = re.compile(r"^[a-z_][a-z0-9_]*$")


def _schema_from_env(name: str, default: str) -> str:
    value = (os.environ.get(name) or default).strip()
    if not _IDENTIFIER_RE.fullmatch(value):
        raise ValueError(
            f"{name} must be a lowercase PostgreSQL identifier matching "
            "[a-z_][a-z0-9_]*"
        )
    return value


def meeting_joiner_schema() -> str:
    return _schema_from_env("MEETING_JOINER_SCHEMA", "public")


def pgqueuer_schema() -> str:
    return _schema_from_env("MEETING_JOINER_PGQUEUER_SCHEMA", "pgqueuer")


def quote_identifier(identifier: str) -> str:
    if not _IDENTIFIER_RE.fullmatch(identifier):
        raise ValueError(
            f"PostgreSQL identifier must match [a-z_][a-z0-9_]*: {identifier!r}"
        )
    return f'"{identifier}"'


def qualified_name(name: str, schema: str | None = None) -> str:
    schema_name = schema or meeting_joiner_schema()
    return f"{quote_identifier(schema_name)}.{quote_identifier(name)}"
