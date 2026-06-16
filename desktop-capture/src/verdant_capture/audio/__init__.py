"""Audio capture: device discovery + a streaming PCM source."""

from __future__ import annotations

from .capture import AudioChunk, AudioSource
from .devices import (
    AudioDevice,
    BLACKHOLE_SETUP_HELP,
    find_loopback_device,
    list_input_devices,
    resolve_device,
)

__all__ = [
    "AudioChunk",
    "AudioSource",
    "AudioDevice",
    "BLACKHOLE_SETUP_HELP",
    "find_loopback_device",
    "list_input_devices",
    "resolve_device",
]
