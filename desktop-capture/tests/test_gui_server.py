"""Auth tests for the local GUI control-panel server.

Confirms /api/start and /api/stop reject requests that don't present the
per-launch token (via the CSRF_TOKEN_HEADER header) or that arrive with a
cross-origin ``Origin`` header, and accept requests that present both
correctly — see gui/server.py and gui/panel.py.
"""

from __future__ import annotations

import json
import re
import socket
import threading
from http.client import HTTPConnection
from typing import Iterator

import pytest

from parlor_capture.gui.controller import CaptureController
from parlor_capture.gui.panel import CSRF_TOKEN_HEADER
from parlor_capture.gui.server import serve


class _FakeProc:
    """Fake subprocess handle so /api/start never spawns a real process."""

    pid = 4242

    def poll(self):
        return None

    def terminate(self):
        pass


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


@pytest.fixture()
def running_server() -> Iterator[tuple[str, int, str]]:
    """Start a real server with a fake launcher; yield (host, port, token)."""
    host, port = "127.0.0.1", _free_port()
    controller = CaptureController(launcher=lambda args: _FakeProc())
    server = serve(host=host, port=port, controller=controller)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    body = _get(host, port, "/")
    token_match = re.search(r'name="parlor-capture-token" content="([^"]+)"', body)
    assert token_match, "panel HTML did not embed a CSRF token"
    token = token_match.group(1)

    try:
        yield host, port, token
    finally:
        server.shutdown()
        thread.join(timeout=5)
        server.server_close()


def _get(host: str, port: int, path: str) -> str:
    conn = HTTPConnection(host, port, timeout=5)
    try:
        conn.request("GET", path)
        resp = conn.getresponse()
        return resp.read().decode("utf-8")
    finally:
        conn.close()


def _post(host: str, port: int, path: str, *, headers: dict[str, str] | None = None):
    conn = HTTPConnection(host, port, timeout=5)
    try:
        conn.request("POST", path, body=json.dumps({}), headers=headers or {})
        resp = conn.getresponse()
        return resp.status, resp.read().decode("utf-8")
    finally:
        conn.close()


def test_panel_html_embeds_a_nonempty_token(running_server):
    _host, _port, token = running_server
    assert len(token) > 20


def test_start_rejected_with_no_token(running_server):
    host, port, _token = running_server
    status, _body = _post(host, port, "/api/start")
    assert status == 403


def test_start_rejected_with_wrong_token(running_server):
    host, port, _token = running_server
    status, _body = _post(
        host, port, "/api/start", headers={CSRF_TOKEN_HEADER: "not-the-real-token"}
    )
    assert status == 403


def test_start_rejected_with_cross_origin_header_even_with_valid_token(running_server):
    host, port, token = running_server
    status, _body = _post(
        host,
        port,
        "/api/start",
        headers={
            CSRF_TOKEN_HEADER: token,
            "Origin": "http://evil.example.com",
        },
    )
    assert status == 403


def test_start_accepted_with_valid_token_and_no_origin(running_server):
    host, port, token = running_server
    status, body = _post(host, port, "/api/start", headers={CSRF_TOKEN_HEADER: token})
    assert status == 200
    assert json.loads(body)["running"] is True


def test_start_accepted_with_valid_token_and_matching_origin(running_server):
    host, port, token = running_server
    status, body = _post(
        host,
        port,
        "/api/start",
        headers={CSRF_TOKEN_HEADER: token, "Origin": f"http://{host}:{port}"},
    )
    assert status == 200
    assert json.loads(body)["running"] is True


def test_stop_rejected_without_token(running_server):
    host, port, _token = running_server
    status, _body = _post(host, port, "/api/stop")
    assert status == 403


def test_stop_accepted_with_valid_token(running_server):
    host, port, token = running_server
    # Start first so stop has something to act on.
    _post(host, port, "/api/start", headers={CSRF_TOKEN_HEADER: token})
    status, body = _post(host, port, "/api/stop", headers={CSRF_TOKEN_HEADER: token})
    assert status == 200
    assert json.loads(body)["running"] is False


def test_status_get_endpoint_does_not_require_a_token(running_server):
    """Read-only GET endpoints are unaffected by the auth added to POSTs."""
    host, port, _token = running_server
    body = _get(host, port, "/api/status")
    assert "running" in json.loads(body)
