"""Local desktop GUI control panel wrapping the parlor-capture CLI.

`build_capture_args` (pure) maps a form dict to CLI args; `CaptureController`
manages the capture subprocess lifecycle (injectable launcher for tests). The
server serves a one-file HTML panel and JSON control endpoints.
"""

from .controller import CaptureController, build_capture_args

__all__ = ["CaptureController", "build_capture_args"]
