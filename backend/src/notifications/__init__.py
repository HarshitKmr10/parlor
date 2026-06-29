"""Per-user notifications / activity inbox.

A reusable :func:`notify` helper writes rows that the web inbox + bell read.
Emit sources so far: comment @mentions; designed for trackers, recap-ready and
digest to fan in next.
"""

from .repo import NotificationsRepo
from .service import notify

__all__ = ["NotificationsRepo", "notify"]
