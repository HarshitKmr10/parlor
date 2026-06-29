"""Unit tests for the desktop GUI controller + arg builder."""

import pytest

from verdant_capture.gui import CaptureController, build_capture_args


def test_build_args_minimal_defaults():
    args = build_capture_args({})
    assert args[0] == "capture"
    assert "--no-live" in args
    assert "--stt" in args and "mock" in args


def test_build_args_full_form():
    args = build_capture_args(
        {
            "title": "Sync",
            "meetingUrl": "https://meet.google.com/x",
            "device": "2",
            "stt": "faster-whisper",
            "sttModel": "base",
            "chunkSeconds": "8",
            "mockAudio": True,
            "local": True,
            "summarize": False,
        }
    )
    joined = " ".join(args)
    assert "--title Sync" in joined
    assert "--meeting-url https://meet.google.com/x" in joined
    assert "--device 2" in joined
    assert "--stt faster-whisper" in joined and "--stt-model base" in joined
    assert "--chunk-seconds 8" in joined
    assert "--mock-audio" in args and "--local" in args and "--no-summarize" in args


def test_default_device_omitted():
    assert "--device" not in build_capture_args({"device": "default"})


class _FakeProc:
    def __init__(self):
        self.pid = 4242
        self._alive = True
        self.terminated = False

    def poll(self):
        return None if self._alive else 0

    def terminate(self):
        self.terminated = True
        self._alive = False


def test_controller_start_stop_lifecycle():
    proc = _FakeProc()
    ctrl = CaptureController(launcher=lambda args: proc)
    assert ctrl.running is False

    status = ctrl.start({"title": "T", "mockAudio": True})
    assert status["running"] is True
    assert status["pid"] == 4242
    assert ctrl.running is True

    # Double-start is rejected.
    with pytest.raises(RuntimeError):
        ctrl.start({})

    stopped = ctrl.stop()
    assert proc.terminated is True
    assert stopped["running"] is False
