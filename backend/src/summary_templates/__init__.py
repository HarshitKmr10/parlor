"""Custom summary templates — per-meeting-type summary formats.

A workspace defines named templates (instructions + ordered sections); the
chosen (or default) template steers the summarizer, so a sales call and a
standup produce differently-shaped recaps. Built-in :data:`PRESETS` give users
a starting library.
"""

from __future__ import annotations

from .presets import PRESETS, preset_by_key
from .repo import SummaryTemplatesRepo
from .meta import template_to_meta

__all__ = ["PRESETS", "preset_by_key", "SummaryTemplatesRepo", "template_to_meta"]
