"""Render a digest dict to plain text for email/Slack delivery."""

from __future__ import annotations

from typing import Any, Mapping


def _fmt_hours(sec: float) -> str:
    return f"{sec / 3600:.1f}h"


def render_digest_text(digest: Mapping[str, Any], workspace_name: str = "your workspace") -> str:
    """A compact, readable digest body. Works for both email and Slack."""
    lines = [
        f"Parlor digest for {workspace_name}",
        "",
        f"Meetings: {digest['meeting_count']} ({digest['completed_count']} completed)",
        f"Time captured: {_fmt_hours(digest['total_duration_sec'])}",
    ]
    if digest.get("busiest_day"):
        lines.append(f"Busiest day: {digest['busiest_day']}")
    ai = digest["action_items"]
    lines.append("")
    lines.append(f"Action items: {ai['open']} open / {ai['done']} done / {ai['total']} total")
    for a in ai.get("by_assignee", [])[:8]:
        lines.append(f"  - {a['assignee']}: {a['done']}/{a['open'] + a['done']} done")
    meetings = digest.get("meetings", [])
    if meetings:
        lines.append("")
        lines.append("Recent meetings:")
        for m in meetings[:10]:
            lines.append(f"  - {m.get('title') or 'Untitled meeting'}")
    return "\n".join(lines)
