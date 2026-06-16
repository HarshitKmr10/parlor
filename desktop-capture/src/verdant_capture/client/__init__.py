"""Backend product-API client + transcript segment shaping."""

from __future__ import annotations

from .api import VerdantClient
from .segments import Segment, segment_from_stt

__all__ = ["VerdantClient", "Segment", "segment_from_stt"]
