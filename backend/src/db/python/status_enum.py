"""Validator for the meeting_joiner_status enum.

Prisma's generated client enforced valid values via its type system. Raw
SQL inserts bypass that — the Postgres ENUM constraint still rejects bad
values, but the error surface is much later. This validator fails fast
at the application boundary with a clear message.
"""

from __future__ import annotations

from typing import Final

STATUSES: Final[tuple[str, ...]] = (
    "not_joined", "scheduled", "joining", "ongoing", "interrupted",
    "completed", "failed",
)


def is_status(value: object) -> bool:
    return isinstance(value, str) and value in STATUSES


def assert_status(value: object) -> str:
    if not is_status(value):
        raise ValueError(
            f"invalid meeting_joiner status: {value!r}; "
            f"expected one of {', '.join(STATUSES)}"
        )
    return value  # type: ignore[return-value]
