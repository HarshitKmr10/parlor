"""Private, per-user free-text notes attached to a meeting.

``MeetingNotesRepo`` persists a single note per (user_id, meeting_id) pair, so
each user keeps their own note on a meeting that only they can see.
"""

from .repo import MeetingNotesRepo

__all__ = ["MeetingNotesRepo"]
