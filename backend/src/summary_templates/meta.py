"""Pure: project a stored template row into the summarizer ``meta.template``."""

from __future__ import annotations

from typing import Any, Dict, Optional


def template_to_meta(template: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Shape a template row for the ai-service summarize payload.

    Returns None when there is no template, so callers can omit the key entirely
    and the summarizer falls back to its default behavior.
    """
    if not template:
        return None
    return {
        "name": template.get("name") or "",
        "instructions": template.get("instructions") or "",
        "sections": list(template.get("sections") or []),
    }
