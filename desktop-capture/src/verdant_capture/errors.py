"""Typed errors for the capture client.

Every user-facing failure should surface as a :class:`CaptureError` (or a
subclass) carrying a clear, actionable message. The CLI catches these and
prints the message instead of a raw traceback.
"""

from __future__ import annotations


class CaptureError(Exception):
    """Base class for all expected, user-facing capture failures."""


class ConfigError(CaptureError):
    """Configuration is missing or invalid (e.g. no API URL / credentials)."""


class AuthError(CaptureError):
    """Authentication against the backend failed."""


class BackendError(CaptureError):
    """The backend returned an error or was unreachable."""


class AudioDeviceError(CaptureError):
    """No usable audio input device, or capture could not start."""


class STTError(CaptureError):
    """A speech-to-text backend failed to initialise or transcribe."""
