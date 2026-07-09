"""Ephemeral-demo reset job.

Runs as a Cloud Run Job, triggered on a schedule by Cloud Scheduler (every
~10 minutes, matching the Uptime Kuma public-demo precedent — see
../README.md for the full reasoning). Not deployed or executed anywhere yet;
this is the planned implementation for when a maintainer stands up the real
GCP project.

Two phases:
  1. Wipe every product/app table via TRUNCATE ... RESTART IDENTITY CASCADE,
     so no visitor's data survives a reset cycle.
  2. Re-seed one fixed demo workspace with a couple of canned mock meetings
     by calling the backend's own public API — the same botless-capture
     sequence cookbook/01-botless-capture/run.py already demonstrates and
     verifies — rather than hand-writing SQL INSERTs that could drift out of
     sync with the schema.

Requires DATABASE_URL (a Cloud SQL Postgres connection string reachable via
the Cloud SQL Auth Proxy sidecar this job is deployed with) and BACKEND_URL
(the demo's own Cloud Run backend service URL) as env vars.
"""

import os
import sys
import uuid

import httpx
import psycopg2

DEMO_EMAIL = "demo@parlor.example.com"
DEMO_PASSWORD = "ParlorDemo123!"

# Mirrors backend/db/*.sql's product tables. Kept in sync by hand — there is
# no automated schema introspection here on purpose, so a bad TRUNCATE list
# fails loudly (a missing table just doesn't get wiped, which is safer than
# TRUNCATEing something schema-introspection guessed wrong).
TABLES_TO_TRUNCATE = [
    "meeting_comments",
    "meeting_shares",
    "meeting_highlights",
    "action_items",
    "tracker_hits",
    "trackers",
    "notifications",
    "webhook_deliveries",
    "webhook_endpoints",
    "audit_events",
    "speaker_profiles",
    "llm_usage_events",
    "idempotency_keys",
    "meeting_joiner",  # the meetings table itself is named meeting_joiner
    "meeting_sessions",
    "calendar_accounts",
    "workspace_integrations",
    "sso_identities",
    "api_keys",
    "refresh_tokens",
    "workspace_members",
    "workspaces",
    "users",
]


def truncate_all(database_url: str) -> None:
    conn = psycopg2.connect(database_url)
    conn.autocommit = True
    with conn.cursor() as cur:
        table_list = ", ".join(TABLES_TO_TRUNCATE)
        cur.execute(f"TRUNCATE TABLE {table_list} RESTART IDENTITY CASCADE;")
    conn.close()
    print(f"Truncated {len(TABLES_TO_TRUNCATE)} tables.")


def reseed_demo_content(backend_url: str) -> None:
    base = backend_url.rstrip("/")

    r = httpx.post(
        f"{base}/api/v1/auth/signup",
        json={
            "email": DEMO_EMAIL,
            "password": DEMO_PASSWORD,
            "name": "Parlor Demo",
            "workspaceName": "Parlor Demo Workspace",
        },
        timeout=30,
    )
    r.raise_for_status()
    auth = r.json()
    headers = {
        "Authorization": f"Bearer {auth['accessToken']}",
        "X-Workspace-Id": auth["workspace"]["id"],
    }

    canned_meetings = [
        {
            "title": "Weekly roadmap sync",
            "segments": [
                ("You", "Let's kick off the roadmap review.", 0.0, 4.0),
                ("Them", "Sure — first item is the export formats work.", 4.0, 9.0),
                ("You", "And after that, the PyPI packaging for desktop-capture.", 9.0, 14.0),
            ],
        },
        {
            "title": "Customer onboarding call",
            "segments": [
                ("You", "Thanks for joining — let's walk through setup.", 0.0, 3.5),
                ("Them", "We're most interested in the botless capture path.", 3.5, 8.0),
                ("You", "Great, that's the default — no bot ever joins your call.", 8.0, 13.0),
            ],
        },
    ]

    for demo_meeting in canned_meetings:
        r = httpx.post(
            f"{base}/api/v1/meetings/botless",
            json={"title": demo_meeting["title"], "platform": "desktop"},
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
                "tStartSec": start,
                "tEndSec": end,
                "createdAt": "2026-07-09T09:00:00Z",
            }
            for speaker, text, start, end in demo_meeting["segments"]
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
        print(f"Reseeded meeting {meeting_id!r} ({demo_meeting['title']!r}).")

    print(f"Demo account ready: {DEMO_EMAIL} / {DEMO_PASSWORD}")


def main() -> int:
    database_url = os.environ.get("DATABASE_URL")
    backend_url = os.environ.get("BACKEND_URL")
    if not database_url or not backend_url:
        print("DATABASE_URL and BACKEND_URL must both be set.", file=sys.stderr)
        return 1

    truncate_all(database_url)
    reseed_demo_content(backend_url)
    print("Demo reset complete.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
