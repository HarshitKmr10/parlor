"""Minimal local control-panel server for the desktop capture GUI.

Serves a one-file HTML panel + JSON control endpoints backed by
:class:`CaptureController`. Uses only the Python stdlib so the packaged CLI can
launch it with no extra dependencies — `parlor-capture gui` opens it locally.
"""

from __future__ import annotations

import hmac
import json
import secrets
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

from .controller import CaptureController
from .panel import CSRF_TOKEN_HEADER, render_panel


def _list_devices() -> list[dict[str, Any]]:
    try:
        from ..audio.devices import list_input_devices  # noqa: PLC0415

        return [
            {"index": getattr(d, "index", i), "name": getattr(d, "name", str(d))}
            for i, d in enumerate(list_input_devices())
        ]
    except Exception:  # noqa: BLE001 — no audio hardware / driver: empty list
        return []


def make_handler(controller: CaptureController, token: str, expected_origin: str):
    """Build the request handler for a single ``serve()`` launch.

    ``token`` and ``expected_origin`` are per-launch secrets/values baked in
    by :func:`serve` — state-changing requests (``/api/start``, ``/api/stop``)
    must present the matching token header and, if an ``Origin`` header is
    sent at all, it must match this server's own origin.
    """

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

        def _is_authorized(self) -> bool:
            origin = self.headers.get("Origin")
            if origin is not None and origin != expected_origin:
                return False
            supplied = self.headers.get(CSRF_TOKEN_HEADER, "")
            return hmac.compare_digest(supplied, token)

        def do_GET(self):  # noqa: N802
            if self.path == "/" or self.path.startswith("/index"):
                body = render_panel(token).encode("utf-8")
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
            if self.path in ("/api/start", "/api/stop") and not self._is_authorized():
                self._json({"error": "forbidden"}, 403)
                return
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


def serve(
    host: str = "127.0.0.1",
    port: int = 8787,
    controller: CaptureController | None = None,
) -> ThreadingHTTPServer:
    controller = controller if controller is not None else CaptureController()
    token = secrets.token_urlsafe(32)
    expected_origin = f"http://{host}:{port}"
    server = ThreadingHTTPServer((host, port), make_handler(controller, token, expected_origin))
    return server
