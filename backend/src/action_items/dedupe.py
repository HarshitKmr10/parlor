"""Pure normalization/dedupe for AI-extracted action items."""

from __future__ import annotations

import hashlib
import re
from typing import Any, Dict, Iterable, List

_WS_RE = re.compile(r"\s+")


def _normalize(text: str) -> str:
    return _WS_RE.sub(" ", (text or "").strip().lower())


def dedupe_key(text: str) -> str:
    """Stable key for an action item's text (whitespace/case-insensitive)."""
    return hashlib.md5(_normalize(text).encode("utf-8")).hexdigest()


def dedupe_ai_items(items: Iterable[Any]) -> List[Dict[str, str]]:
    """Project raw AI action items to ``{text, assignee, due_date, dedupe_key}``.

    Accepts dicts or objects with ``text``/``assignee``/``due_date`` attributes.
    Drops blanks and collapses duplicates (first occurrence wins).
    """
    out: List[Dict[str, str]] = []
    seen: set[str] = set()
    for item in items or []:
        text = _field(item, "text")
        if not text or not text.strip():
            continue
        key = dedupe_key(text)
        if key in seen:
            continue
        seen.add(key)
        out.append(
            {
                "text": text.strip(),
                "assignee": _field(item, "assignee"),
                "due_date": _field(item, "due_date") or _field(item, "dueDate"),
                "dedupe_key": key,
            }
        )
    return out


def _field(item: Any, name: str) -> str | None:
    if isinstance(item, dict):
        val = item.get(name)
    else:
        val = getattr(item, name, None)
    return val if (val is None or isinstance(val, str)) else str(val)
