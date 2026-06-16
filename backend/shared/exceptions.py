"""
Custom exceptions for the Meeting Joiner Service
"""


class MeetingJoinerError(Exception):
    """Base exception for meeting joiner service"""

    pass


class MeetingNotFoundError(MeetingJoinerError):
    """Exception raised when a meeting is not found"""

    pass


class InvalidMeetingURLError(MeetingJoinerError):
    """Exception raised when meeting URL is invalid"""

    pass


class MeetingAlreadyInProgressError(MeetingJoinerError):
    """Exception raised when trying to start a meeting that's already in progress"""

    pass


class BotJoinError(MeetingJoinerError):
    """Exception raised when bot fails to join meeting"""

    pass


class TranscriptionError(MeetingJoinerError):
    """Exception raised when transcription processing fails"""

    pass


class StorageError(MeetingJoinerError):
    """Exception raised when storage operations fail"""

    pass


class QueueError(MeetingJoinerError):
    """Exception raised when queue operations fail"""

    pass


class DatabaseError(MeetingJoinerError):
    """Exception raised when database operations fail"""

    pass
