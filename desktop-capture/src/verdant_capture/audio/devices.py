"""Audio input device discovery and loopback detection (macOS-first).

macOS has no built-in way to record system audio: Core Audio does not expose
the output mix as an input. The common fix is a virtual loopback device such
as **BlackHole** (or a multi-output / Aggregate Device built around it). This
module detects such a device so we can capture *meeting* audio rather than
just the microphone, and falls back to the default mic when none is present.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from ..errors import AudioDeviceError

# Substrings that identify a virtual loopback / aggregate capture device.
_LOOPBACK_HINTS = (
    "blackhole",
    "loopback",
    "aggregate",
    "soundflower",
    "vb-cable",
    "vb-audio",
    "multi-output",
)

BLACKHOLE_SETUP_HELP = """\
No system-audio loopback device was found, so meeting audio cannot be captured
directly. Falling back to the microphone (it will still record your voice, and
the other side if it comes through your speakers, but quality is lower).

To capture true system/meeting audio on macOS, install a loopback device:

  1. Install BlackHole (2ch is enough):
       brew install blackhole-2ch
     ...or download from https://existential.audio/blackhole/

  2. (Recommended) Create an Aggregate Device so you keep hearing audio while
     recording it:
       - Open "Audio MIDI Setup" (in /Applications/Utilities).
       - Click "+" -> "Create Multi-Output Device".
       - Tick both your normal output (e.g. "MacBook Speakers") and
         "BlackHole 2ch". Set it as the system output during the meeting.
       - For capture, select "BlackHole 2ch" as the input here, or build an
         Aggregate Device combining BlackHole + your mic to record both sides.

  3. Re-run with the loopback device:
       parlor-capture --list-devices          # find its index/name
       parlor-capture --device "BlackHole 2ch" ...
"""


@dataclass(frozen=True)
class AudioDevice:
    index: int
    name: str
    max_input_channels: int
    default_samplerate: float
    is_loopback: bool

    def __str__(self) -> str:  # pragma: no cover - display only
        tag = " [loopback]" if self.is_loopback else ""
        return (
            f"[{self.index}] {self.name}{tag} "
            f"({self.max_input_channels}ch @ {int(self.default_samplerate)}Hz)"
        )


def _import_sounddevice():
    """Import sounddevice lazily so `--help` works without PortAudio present."""
    try:
        import sounddevice as sd  # noqa: PLC0415
    except OSError as exc:  # PortAudio shared lib missing
        raise AudioDeviceError(
            "PortAudio is not available. On macOS install it with "
            "`brew install portaudio`, then reinstall sounddevice."
        ) from exc
    except ImportError as exc:
        raise AudioDeviceError(
            "The 'sounddevice' package is not installed. Install the client "
            "with its dependencies: `pip install -e .`"
        ) from exc
    return sd


def _looks_like_loopback(name: str) -> bool:
    lowered = name.lower()
    return any(hint in lowered for hint in _LOOPBACK_HINTS)


def list_input_devices() -> list[AudioDevice]:
    """Return all devices that can be used as an input source."""
    sd = _import_sounddevice()
    devices: list[AudioDevice] = []
    for index, info in enumerate(sd.query_devices()):
        if int(info.get("max_input_channels", 0)) <= 0:
            continue
        name = str(info.get("name", f"device-{index}"))
        devices.append(
            AudioDevice(
                index=index,
                name=name,
                max_input_channels=int(info["max_input_channels"]),
                default_samplerate=float(info.get("default_samplerate") or 16000),
                is_loopback=_looks_like_loopback(name),
            )
        )
    return devices


def find_loopback_device() -> Optional[AudioDevice]:
    """Return the first detected loopback input device, or ``None``."""
    for device in list_input_devices():
        if device.is_loopback:
            return device
    return None


def _default_input_device(devices: list[AudioDevice]) -> AudioDevice:
    sd = _import_sounddevice()
    try:
        default_index = sd.default.device[0]
    except (TypeError, IndexError):
        default_index = None
    if isinstance(default_index, int) and default_index >= 0:
        for device in devices:
            if device.index == default_index:
                return device
    return devices[0]


def resolve_device(selector: Optional[str]) -> tuple[AudioDevice, bool]:
    """Resolve the audio device to capture from.

    Returns ``(device, used_fallback)`` where ``used_fallback`` is True when no
    explicit selector was given *and* no loopback device existed, so we fell
    back to the default microphone.

    ``selector`` may be a device index (e.g. ``"3"``) or a case-insensitive
    name substring (e.g. ``"BlackHole"``).
    """
    devices = list_input_devices()
    if not devices:
        raise AudioDeviceError(
            "No audio input devices were found. Check microphone/loopback "
            "permissions in System Settings -> Privacy & Security -> Microphone."
        )

    if selector is not None:
        selector = selector.strip()
        if selector.isdigit():
            idx = int(selector)
            match = next((d for d in devices if d.index == idx), None)
            if match is None:
                raise AudioDeviceError(
                    f"No input device with index {idx}. Run --list-devices."
                )
            return match, False
        lowered = selector.lower()
        match = next((d for d in devices if lowered in d.name.lower()), None)
        if match is None:
            raise AudioDeviceError(
                f"No input device matching '{selector}'. Run --list-devices."
            )
        return match, False

    # No explicit selector: prefer a loopback device, else fall back to mic.
    loopback = next((d for d in devices if d.is_loopback), None)
    if loopback is not None:
        return loopback, False
    return _default_input_device(devices), True
