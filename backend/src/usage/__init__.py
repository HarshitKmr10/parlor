"""Workspace usage analytics — meetings, minutes, active members.

`summarize_usage` is a pure aggregation over meeting rows (unit-tested); the
route serves it for the admin usage dashboard.
"""

from .summary import summarize_usage

__all__ = ["summarize_usage"]
