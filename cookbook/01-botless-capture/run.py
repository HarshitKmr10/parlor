"""Botless capture, minimal version: post transcript segments straight to the
Parlor backend with no server-side bot ever joining a call.

This mirrors what `desktop-capture/` does locally (capture audio -> transcribe
-> stream segments) but strips out the audio/STT layer so the *backend
contract* is easy to read end to end: signup -> create a botless meeting ->
append transcript segments -> mark it complete.

Usage:
    pip install httpx
    python run.py [--base-url http://localhost:8001]
"""

import argparse
import uuid
from urllib.parse import urlparse

import httpx

_LOOPBACK_HOSTS = {"localhost", "127.0.0.1", "::1"}


def _require_secure(url: str) -> str:
    """Refuse a plaintext-http base URL for a non-loopback host: this script
    signs up and then sends the returned bearer token on every request, so
    http:// to a remote host would leak it."""
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    if parsed.scheme != "https" and host not in _LOOPBACK_HOSTS:
        raise SystemExit(
            f"--base-url must use https:// (got {parsed.scheme}://{host}). "
            "It carries a bearer token; use https, or a loopback host locally."
        )
    return url


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://localhost:8001")
    args = parser.parse_args()
    base = _require_secure(args.base_url).rstrip("/")

    email = f"cookbook-{uuid.uuid4().hex[:8]}@example.com"
    print(f"1. Signing up {email} ...")
    r = httpx.post(
        f"{base}/api/v1/auth/signup",
        json={
            "email": email,
            "password": "CookbookDemo123!",
            "name": "Cookbook Demo",
            "workspaceName": "Cookbook Workspace",
        },
        timeout=30,
    )
    r.raise_for_status()
    auth = r.json()
    headers = {
        "Authorization": f"Bearer {auth['accessToken']}",
        "X-Workspace-Id": auth["workspace"]["id"],
    }
    print(f"   workspace={auth['workspace']['id']}")

    print("2. Creating a botless meeting (no bot dispatched) ...")
    r = httpx.post(
        f"{base}/api/v1/meetings/botless",
        json={"title": "Cookbook botless demo", "source": "desktop"},
        headers=headers,
        timeout=30,
    )
    r.raise_for_status()
    meeting = r.json()
    meeting_id = meeting["id"]
    print(f"   meeting id={meeting_id} platform={meeting['platform']!r} "
          f"meetingUrl={meeting['meetingUrl']!r} status={meeting['status']!r}")

    print("3. Streaming transcript segments as if a local capture client produced them ...")
    segments = [
        {
            "id": str(uuid.uuid4()),
            "speakerId": None,
            "speakerName": "You",
            "text": "Let's kick off the roadmap review.",
            "tStartSec": 0.0,
            "tEndSec": 4.0,
            "createdAt": "2026-07-08T21:00:00Z",
        },
        {
            "id": str(uuid.uuid4()),
            "speakerId": None,
            "speakerName": "Them",
            "text": "Sure, first item is the PyPI packaging work.",
            "tStartSec": 4.0,
            "tEndSec": 9.0,
            "createdAt": "2026-07-08T21:00:05Z",
        },
    ]
    r = httpx.post(
        f"{base}/api/v1/meetings/{meeting_id}/transcript",
        json={"segments": segments},
        headers=headers,
        timeout=30,
    )
    r.raise_for_status()
    print(f"   appended={r.json()['appended']}")

    print("4. Marking the meeting complete (fires the embed+summarize pipeline) ...")
    r = httpx.post(f"{base}/api/v1/meetings/{meeting_id}/complete", headers=headers, timeout=30)
    r.raise_for_status()
    print(f"   status={r.json()['status']!r}")

    print()
    print(f"Done. No bot ever joined a call — see meeting {meeting_id} at "
          f"{base}/api/v1/meetings/{meeting_id} (or the web UI at the "
          "port from your .env, e.g. http://localhost:3001).")
    print("Next: run ../02-mock-mode-summary-and-ask/run.py to see /summarize "
          "and /ask work over a transcript like this one with zero LLM keys.")


if __name__ == "__main__":
    main()
