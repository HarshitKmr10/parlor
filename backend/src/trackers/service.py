"""Run trackers against a meeting's transcript on completion.

Scans enabled trackers, persists new hits (dedup-aware), and notifies the
meeting owner per tracker that fired. Best-effort — never raises into the
summarize path.
"""

from __future__ import annotations

import logging
from typing import Any, Optional, Sequence

from ..notifications import notify
from .repo import TrackersRepo
from .scan import scan_segments

logger = logging.getLogger("trackers")


async def run_trackers(
    db,
    *,
    workspace_id: str,
    meeting_id: str,
    segments: Sequence[Any],
    owner_id: Optional[str] = None,
) -> int:
    """Scan + persist hits. Returns the number of NEW hits recorded."""
    try:
        repo = TrackersRepo(db)
        trackers = await repo.list_enabled(workspace_id)
        if not trackers:
            return 0
        hits = scan_segments(trackers, segments)
        new_count = 0
        fired: dict[str, str] = {}  # tracker_id -> name
        names = {str(t["id"]): t["name"] for t in trackers}
        for h in hits:
            wrote = await repo.record_hit(
                tracker_id=h["tracker_id"],
                workspace_id=workspace_id,
                meeting_id=meeting_id,
                matched_keyword=h["matched_keyword"],
                snippet=h["snippet"],
                segment_id=h["segment_id"],
                t_start_sec=h["t_start_sec"],
            )
            if wrote:
                new_count += 1
                fired.setdefault(h["tracker_id"], names.get(h["tracker_id"], "Tracker"))
        # Notify the owner once per tracker that fired (best-effort).
        if owner_id and fired:
            for tracker_id, name in fired.items():
                await notify(
                    db,
                    workspace_id=workspace_id,
                    user_ids=[owner_id],
                    type="tracker",
                    title=f'Tracker "{name}" matched',
                    body=f'Mentions of "{name}" were found in a meeting.',
                    link=f"/meetings/{meeting_id}",
                    meeting_id=meeting_id,
                )
        return new_count
    except Exception as exc:  # noqa: BLE001 — best-effort
        logger.warning("run_trackers failed for %s: %s", meeting_id, exc)
        return 0
