"""HTTP client for the Verdant backend product API (``/api/v1``).

Auth: either a workspace API key (``X-API-Key``) — which alone identifies the
workspace — or email/password login that yields a Bearer access token plus a
chosen ``X-Workspace-Id``.

Botless capture vs. the contract
--------------------------------
The public contract (docs/API-CONTRACT.md) now exposes a botless path:

* ``POST /api/v1/meetings/botless`` creates a workspace-scoped meeting WITHOUT
  dispatching a bot (synthetic ``desktop://`` URL, ``platform: 'desktop'``,
  ``status: 'ongoing'``). Used when no real meeting URL is given.
* ``POST /api/v1/meetings/{id}/transcript`` ingests batches of captured
  segments server-side (the default ingest path here).
* ``POST /api/v1/meetings/{id}/complete`` finalizes the session and triggers
  the embed+summarize pipeline.

A real meeting URL still routes through ``POST /api/v1/meetings`` (which
dispatches a server-side bot). If the backend is older and lacks the ingest
endpoint (404/405), segment streaming degrades gracefully: it keeps the local
transcript and still drives ``/summarize`` with the collected segments.

Every network failure raises a typed :class:`BackendError`/:class:`AuthError`
with a clear message — the CLI never shows a raw traceback.
"""

from __future__ import annotations

from typing import Any, Optional

import httpx

from ..config import Config
from ..errors import AuthError, BackendError, ConfigError

_TIMEOUT = httpx.Timeout(15.0, connect=8.0)


class VerdantClient:
    def __init__(self, config: Config) -> None:
        if not config.api_url:
            raise ConfigError("No API URL configured (set VERDANT_API_URL).")
        self._config = config
        self._base = config.api_url.rstrip("/")
        self._access_token: Optional[str] = None
        self._workspace_id: Optional[str] = config.workspace_id
        self._client = httpx.Client(base_url=self._base, timeout=_TIMEOUT)

    # ── lifecycle ───────────────────────────────────────────────────────
    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> "VerdantClient":
        return self

    def __exit__(self, *_exc) -> None:
        self.close()

    # ── auth ────────────────────────────────────────────────────────────
    def _auth_headers(self) -> dict[str, str]:
        if self._config.api_key:
            return {"X-API-Key": self._config.api_key}
        headers: dict[str, str] = {}
        if self._access_token:
            headers["Authorization"] = f"Bearer {self._access_token}"
        if self._workspace_id:
            headers["X-Workspace-Id"] = self._workspace_id
        return headers

    def authenticate(self) -> str:
        """Resolve credentials. Returns a short description of the auth mode."""
        if self._config.api_key:
            # API key carries its own workspace; nothing to fetch.
            return "workspace API key"
        if not (self._config.email and self._config.password):
            raise ConfigError(
                "No credentials. Provide --api-key, or --email/--password "
                "(or the VERDANT_* equivalents)."
            )
        try:
            resp = self._client.post(
                "/api/v1/auth/login",
                json={
                    "email": self._config.email,
                    "password": self._config.password,
                },
            )
        except httpx.HTTPError as exc:
            raise BackendError(self._conn_msg(exc)) from exc
        if resp.status_code == 401:
            raise AuthError("Login failed: incorrect email or password.")
        self._raise_for_status(resp, "login")
        data = resp.json()
        self._access_token = data.get("accessToken")
        if not self._access_token:
            raise AuthError("Login succeeded but no access token was returned.")
        if not self._workspace_id:
            self._workspace_id = self._discover_workspace()
        return f"login as {self._config.email}"

    def _discover_workspace(self) -> str:
        try:
            resp = self._client.get("/api/v1/auth/me", headers=self._auth_headers())
            self._raise_for_status(resp, "auth/me")
            data = resp.json()
        except httpx.HTTPError as exc:
            raise BackendError(self._conn_msg(exc)) from exc
        workspaces = data.get("workspaces") or []
        if not workspaces:
            raise ConfigError("Account has no workspaces; cannot capture.")
        return str(workspaces[0]["id"])

    @property
    def workspace_id(self) -> Optional[str]:
        return self._workspace_id

    # ── meetings ────────────────────────────────────────────────────────
    def create_meeting(
        self, *, meeting_url: str, title: Optional[str], scheduled_at: Optional[str]
    ) -> dict[str, Any]:
        body: dict[str, Any] = {"meetingUrl": meeting_url}
        if title:
            body["title"] = title
        if scheduled_at:
            body["scheduledAt"] = scheduled_at
        try:
            resp = self._client.post(
                "/api/v1/meetings", json=body, headers=self._auth_headers()
            )
        except httpx.HTTPError as exc:
            raise BackendError(self._conn_msg(exc)) from exc
        if resp.status_code == 400:
            raise BackendError(
                "Backend rejected the meeting URL. The product API only accepts "
                "zoom/meet/teams URLs (it would dispatch a bot). Pass the real "
                "meeting URL via --meeting-url, or run --local for offline demo."
            )
        self._raise_for_status(resp, "create meeting")
        return resp.json()

    def create_botless_meeting(
        self, *, title: Optional[str]
    ) -> dict[str, Any]:
        """Create a botless (desktop-capture) meeting via ``/meetings/botless``.

        No bot is dispatched; the backend assigns a synthetic ``desktop://``
        URL and starts the meeting ``ongoing``.
        """
        body: dict[str, Any] = {"source": "desktop"}
        if title:
            body["title"] = title
        try:
            resp = self._client.post(
                "/api/v1/meetings/botless", json=body, headers=self._auth_headers()
            )
        except httpx.HTTPError as exc:
            raise BackendError(self._conn_msg(exc)) from exc
        self._raise_for_status(resp, "create botless meeting")
        return resp.json()

    def post_segments(
        self, meeting_id: str, segments: list[dict[str, Any]]
    ) -> bool:
        """POST a batch of contract ``TranscriptSegment``s to the ingest path.

        Defaults to ``POST /api/v1/meetings/{id}/transcript`` (the public
        ingest endpoint). An explicit ``ingest_path`` override still wins for
        non-standard backends. Returns ``True`` on success. Returns ``False``
        (without raising) when the backend has no such endpoint (404/405) — the
        caller keeps the local transcript and still drives ``/summarize``.
        Connection-level failures still raise :class:`BackendError`.
        """
        if not segments:
            return True
        path = self._config.ingest_path or "/api/v1/meetings/{id}/transcript"
        url = path.replace("{meeting_id}", meeting_id).replace("{id}", meeting_id)
        try:
            resp = self._client.post(
                url, json={"segments": segments}, headers=self._auth_headers()
            )
        except httpx.HTTPError as exc:
            raise BackendError(self._conn_msg(exc)) from exc
        if resp.status_code in (404, 405):
            return False
        self._raise_for_status(resp, "ingest segments")
        return True

    def complete_meeting(self, meeting_id: str) -> dict[str, Any]:
        """Finalize via ``POST /meetings/{id}/complete`` (botless finalize).

        Falls back to the ``DELETE /meetings/{id}`` stop path on 404/405 for
        older backends; both transition the meeting to ``completed`` and fire
        the server-side completion (embed+summarize) pipeline.
        """
        try:
            resp = self._client.post(
                f"/api/v1/meetings/{meeting_id}/complete",
                headers=self._auth_headers(),
            )
        except httpx.HTTPError as exc:
            raise BackendError(self._conn_msg(exc)) from exc
        if resp.status_code in (404, 405):
            return self.stop_meeting(meeting_id)
        self._raise_for_status(resp, "complete meeting")
        return resp.json()

    def summarize(self, meeting_id: str) -> dict[str, Any]:
        try:
            resp = self._client.post(
                f"/api/v1/meetings/{meeting_id}/summarize",
                headers=self._auth_headers(),
            )
        except httpx.HTTPError as exc:
            raise BackendError(self._conn_msg(exc)) from exc
        self._raise_for_status(resp, "summarize")
        return resp.json()

    def stop_meeting(self, meeting_id: str) -> dict[str, Any]:
        try:
            resp = self._client.delete(
                f"/api/v1/meetings/{meeting_id}", headers=self._auth_headers()
            )
        except httpx.HTTPError as exc:
            raise BackendError(self._conn_msg(exc)) from exc
        self._raise_for_status(resp, "stop meeting")
        return resp.json()

    # ── helpers ─────────────────────────────────────────────────────────
    @staticmethod
    def _conn_msg(exc: httpx.HTTPError) -> str:
        return (
            f"Could not reach the backend ({exc}). Is it running and is "
            "VERDANT_API_URL correct?"
        )

    @staticmethod
    def _raise_for_status(resp: httpx.Response, action: str) -> None:
        if resp.is_success:
            return
        message = f"{action} failed (HTTP {resp.status_code})"
        try:
            body = resp.json()
            err = body.get("error") if isinstance(body, dict) else None
            if isinstance(err, dict) and err.get("message"):
                message = f"{action} failed: {err['message']}"
        except Exception:  # noqa: BLE001 — non-JSON error body
            pass
        if resp.status_code in (401, 403):
            raise AuthError(message)
        raise BackendError(message)
