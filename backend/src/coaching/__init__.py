"""Sales coaching scorecards derived from conversation analytics.

Pure, deterministic transformation of a MeetingAnalytics into a scorecard with
an overall grade, actionable tips, and per-speaker grades — the paid coaching
tier in Fathom/tl;dv, built on metrics we already compute.
"""

from .scorecard import compute_coaching

__all__ = ["compute_coaching"]
