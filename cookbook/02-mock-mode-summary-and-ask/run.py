"""Zero-API-key mock mode: /summarize and /ask (RAG) over a transcript with no
ANTHROPIC_API_KEY / OPENAI_API_KEY set anywhere in the stack.

`ai-service` runs in `AI_MODE=mock` whenever no LLM provider key is
configured (the default for a fresh `make up`). This script proves that mode
end to end: it creates a meeting, seeds a small transcript, then calls the
backend's `/summarize` and `/ask` endpoints — both of which proxy to
`ai-service` — and prints the real structured response.

Usage:
    pip install httpx
    python run.py [--base-url http://localhost:8001]
"""

import argparse
import json
import uuid

import httpx

TRANSCRIPT = [
    (
        "Alex",
        "Let's review the Q3 roadmap. Top priority is shipping the PyPI "
        "package for desktop-capture.",
    ),
    (
        "Sam",
        "Agreed. I'll own the GitHub Actions trusted publishing workflow "
        "and have it ready by Friday.",
    ),
    (
        "Alex",
        "Great, and let's also add a cookbook of runnable examples so new "
        "users can see it work end to end.",
    ),
]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://localhost:8001")
    parser.add_argument(
        "--question",
        default="Who owns the PyPI publishing workflow?",
        help="Question to ask the RAG endpoint over the seeded transcript.",
    )
    args = parser.parse_args()
    base = args.base_url.rstrip("/")

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

    print("2. Creating a meeting and seeding a transcript ...")
    r = httpx.post(
        f"{base}/api/v1/meetings/botless",
        json={"title": "Q3 roadmap sync", "source": "desktop"},
        headers=headers,
        timeout=30,
    )
    r.raise_for_status()
    meeting_id = r.json()["id"]

    segments = [
        {
            "id": str(uuid.uuid4()),
            "speakerId": None,
            "speakerName": speaker,
            "text": text,
            "tStartSec": float(i * 6),
            "tEndSec": float(i * 6 + 6),
            "createdAt": f"2026-07-08T21:00:{i * 7:02d}Z",
        }
        for i, (speaker, text) in enumerate(TRANSCRIPT)
    ]
    r = httpx.post(
        f"{base}/api/v1/meetings/{meeting_id}/transcript",
        json={"segments": segments},
        headers=headers,
        timeout=30,
    )
    r.raise_for_status()

    r = httpx.post(f"{base}/api/v1/meetings/{meeting_id}/complete", headers=headers, timeout=30)
    r.raise_for_status()

    print("3. Calling /summarize (no LLM key set -> ai-service AI_MODE=mock) ...")
    r = httpx.post(f"{base}/api/v1/meetings/{meeting_id}/summarize", headers=headers, timeout=60)
    r.raise_for_status()
    summary = r.json()
    print(json.dumps(summary, indent=2))
    assert summary["summary"].startswith("[mock]"), (
        "expected the mock-mode marker; ai-service may be running in live "
        "mode (an LLM key is configured) or something else changed"
    )

    print()
    print(f"4. Calling /ask: {args.question!r} ...")
    r = httpx.post(
        f"{base}/api/v1/meetings/{meeting_id}/ask",
        json={"question": args.question},
        headers=headers,
        timeout=60,
    )
    r.raise_for_status()
    answer = r.json()
    print(json.dumps(answer, indent=2))

    print()
    print("Done. Both responses came from ai-service's mock provider — this "
          "worked with zero LLM API keys configured anywhere in the stack.")


if __name__ == "__main__":
    main()
