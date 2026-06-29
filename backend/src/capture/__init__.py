"""Botless native-capture adapters.

Normalize platform-native transcripts (Zoom, Teams, WebVTT) into the internal
segment shape, then feed the existing transcript-ingest pipeline — no bot in the
room. Adapters are pure + unit-tested; OAuth-based pulling of recordings is the
live wiring on top.
"""

from .adapters import normalize, normalize_teams, normalize_vtt, normalize_zoom

__all__ = ["normalize", "normalize_zoom", "normalize_teams", "normalize_vtt"]
