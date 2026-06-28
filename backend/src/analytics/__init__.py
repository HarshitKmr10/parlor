"""Conversation analytics computed from diarized transcripts.

Pure, deterministic metrics (talk-time, talk-ratio, interactivity, sentiment)
derived entirely from transcript segments — no LLM call — so analytics work even
when the AI service is offline. This is the insight layer that products like
Read.ai, Fathom and tl;dv expose on every meeting.
"""

from __future__ import annotations

from .conversation import compute_meeting_analytics

__all__ = ["compute_meeting_analytics"]
