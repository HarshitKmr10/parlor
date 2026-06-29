"""Scheduled workspace digest emit.

Turns the on-demand /reports/digest into an automatic daily/weekly delivery to
email or Slack. `is_due` is a pure function (unit-tested); the scheduler service
calls it for each workspace's preferences and emits when due.
"""

from .schedule import is_due
from .prefs_repo import DigestPrefsRepo
from .render import render_digest_text

__all__ = ["is_due", "DigestPrefsRepo", "render_digest_text"]
