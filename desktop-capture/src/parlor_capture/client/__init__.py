"""Backend product-API client + transcript segment shaping."""

from __future__ import annotations

from .api import ParlorClient
from .segments import Segment, segment_from_stt

__all__ = ["ParlorClient", "Segment", "segment_from_stt"]
