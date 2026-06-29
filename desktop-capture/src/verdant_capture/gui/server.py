"""Minimal local control-panel server for the desktop capture GUI.

Serves a one-file HTML panel + JSON control endpoints backed by
:class:`CaptureController`. Uses only the Python stdlib so the packaged CLI can
launch it with no extra dependencies — `verdant-capture gui` opens it locally.
"""

from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

from .controller import CaptureController
from .panel import PANEL_HTML


def _list_devices() -> list[dict[str, Any]]:
    try:
        from ..audio.devices import list_input_devices  # noqa: PLC0415

        return [
            {"index": getattr(d, "index", i), "name": getattr(d, "name", str(d))}
            for i, d in enumerate(list_input_devices())
        ]
    except Exception:  # noqa: BLE001 — no audio hardware / driver: empty list
        return []


def make_handler(controller: CaptureController):
    class Handler(BaseHTTPRequestHandler):
        def _json(self, payload: Any, status: int = 200) -> None:
            body = json.dumps(payload).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *args):  # pragma: no cover - quiet
            pass

        def do_GET(self):  # noqa: N802
            if self.path == "/" or self.path.startswith("/index"):
                body = PANEL_HTML.encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            elif self.path == "/api/devices":
                self._json({"devices": _list_devices()})
            elif self.path == "/api/status":
                self._json(controller.status())
            else:
                self._json({"error": "not found"}, 404)

        def do_POST(self):  # noqa: N802
            length = int(self.headers.get("Content-Length", 0) or 0)
            raw = self.rfile.read(length) if length else b"{}"
            try:
                form = json.loads(raw or b"{}")
            except ValueError:
                self._json({"error": "invalid json"}, 400)
                return
            try:
                if self.path == "/api/start":
                    self._json(controller.start(form))
                elif self.path == "/api/stop":
                    self._json(controller.stop())
                else:
                    self._json({"error": "not found"}, 404)
            except RuntimeError as exc:
                self._json({"error": str(exc)}, 409)

    return Handler


def serve(host: str = "127.0.0.1", port: int = 8787) -> ThreadingHTTPServer:
    controller = CaptureController()
    server = ThreadingHTTPServer((host, port), make_handler(controller))
    return server
