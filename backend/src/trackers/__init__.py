"""Topic / keyword trackers (monitors).

`scan_segments` is a pure matcher (unit-tested); the repo persists trackers and
their hits. The summarize pipeline scans on completion and fans hits out to
notifications + webhooks.
"""

from .scan import scan_segments
from .repo import TrackersRepo

__all__ = ["scan_segments", "TrackersRepo"]
