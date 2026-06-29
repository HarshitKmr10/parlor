"""Workspace digest / multi-meeting reports.

Periodic rollups across a workspace's meetings + action items (meeting count,
talk time, open vs done tasks, busiest day) — the weekly-digest feature in
Fireflies / Read.ai. On-demand here; a scheduler can later emit it on a cadence.

Public surface:
* :func:`resolve_range` — parse/default the report window.
* :func:`summarize_meetings` — pure aggregation over meeting rows.
* :class:`ReportsRepo` — workspace-scoped range queries.
"""

from __future__ import annotations

from .aggregate import resolve_range, summarize_meetings
from .repo import ReportsRepo

__all__ = ["resolve_range", "summarize_meetings", "ReportsRepo"]
