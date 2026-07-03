"""GUI → CLI bridge: pure arg building + capture subprocess control."""

from __future__ import annotations

import sys
from typing import Any, Callable, List, Mapping, Optional


def build_capture_args(form: Mapping[str, Any]) -> List[str]:
    """Map a GUI form dict to ``parlor-capture capture`` CLI args (pure).

    Only emits flags for provided/meaningful values so CLI defaults apply.
    """
    args: List[str] = ["capture", "--no-live"]
    if form.get("title"):
        args += ["--title", str(form["title"])]
    if form.get("meetingUrl"):
        args += ["--meeting-url", str(form["meetingUrl"])]
    if form.get("device") not in (None, "", "default"):
        args += ["--device", str(form["device"])]
    stt = str(form.get("stt") or "mock")
    args += ["--stt", stt]
    if stt == "faster-whisper" and form.get("sttModel"):
        args += ["--stt-model", str(form["sttModel"])]
    if stt == "remote" and form.get("sttEndpoint"):
        args += ["--stt-endpoint", str(form["sttEndpoint"])]
    if form.get("chunkSeconds"):
        args += ["--chunk-seconds", str(form["chunkSeconds"])]
    if form.get("duration"):
        args += ["--duration", str(form["duration"])]
    if form.get("mockAudio"):
        args += ["--mock-audio"]
    if form.get("local"):
        args += ["--local"]
    if form.get("summarize") is False:
        args += ["--no-summarize"]
    return args


def _default_launcher(args: List[str]):
    import subprocess  # noqa: PLC0415

    return subprocess.Popen([sys.executable, "-m", "parlor_capture", *args])


class CaptureController:
    """Single-capture lifecycle controller for the GUI."""

    def __init__(self, launcher: Callable[[List[str]], Any] = _default_launcher) -> None:
        self._launcher = launcher
        self._proc: Optional[Any] = None
        self._last_args: List[str] = []

    @property
    def running(self) -> bool:
        return self._proc is not None and self._proc.poll() is None

    def start(self, form: Mapping[str, Any]) -> dict:
        if self.running:
            raise RuntimeError("A capture is already running.")
        self._last_args = build_capture_args(form)
        self._proc = self._launcher(self._last_args)
        return self.status()

    def stop(self) -> dict:
        if self._proc is not None and self._proc.poll() is None:
            self._proc.terminate()
        self._proc = None
        return self.status()

    def status(self) -> dict:
        return {
            "running": self.running,
            "pid": getattr(self._proc, "pid", None) if self.running else None,
            "args": self._last_args,
        }
