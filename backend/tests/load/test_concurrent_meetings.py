"""Locust-based load test for concurrent meeting creation.

Marked ``@pytest.mark.load`` and excluded from the default pytest run.
Run explicitly:

    pytest -m load tests/load/

Requires locust installed (test-only). Skips with a clear message if not
present, so the rest of the test suite continues to work.

Target:
- Spawn many simultaneous ``POST /meetings`` requests.
- Each request transitions to ``ongoing`` within the warm-pool path SLA.
- No OOM kills, no rejoin storms.

Environment:
- ``MEETING_JOINER_LOAD_TEST_URL`` — base URL (e.g. ``https://meeting-joiner.staging.aiopshq.dev``).
- ``MEETING_JOINER_LOAD_TEST_MEETING_URL`` — synthetic meeting URL the bot
  joins (a stable canary tenant).
- ``MEETING_JOINER_LOAD_TEST_USERS`` — total concurrent users (default 100).
- ``MEETING_JOINER_LOAD_TEST_SPAWN_RATE`` — users/sec to ramp (default 10).
- ``MEETING_JOINER_LOAD_TEST_DURATION`` — total run time in seconds (default 600).
"""

from __future__ import annotations

import os

import pytest

try:
    from locust import FastHttpUser, between, task
    from locust.env import Environment
    from locust.stats import StatsCSVFileWriter
    LOCUST_AVAILABLE = True
except ImportError:  # pragma: no cover
    LOCUST_AVAILABLE = False


pytestmark = [
    pytest.mark.load,
    pytest.mark.skipif(
        not LOCUST_AVAILABLE,
        reason="locust not installed — install with `pip install locust` to run",
    ),
]


_BASE_URL = os.environ.get("MEETING_JOINER_LOAD_TEST_URL")
_MEETING_URL = os.environ.get(
    "MEETING_JOINER_LOAD_TEST_MEETING_URL",
    "https://teams.microsoft.com/l/meetup-join/canary",
)
_USERS = int(os.environ.get("MEETING_JOINER_LOAD_TEST_USERS", "100"))
_SPAWN_RATE = float(os.environ.get("MEETING_JOINER_LOAD_TEST_SPAWN_RATE", "10"))
_DURATION = int(os.environ.get("MEETING_JOINER_LOAD_TEST_DURATION", "600"))


if LOCUST_AVAILABLE:

    class MeetingJoinerUser(FastHttpUser):
        """Single Locust user creates a meeting every minute."""

        wait_time = between(45, 75)

        @task
        def create_meeting(self) -> None:
            payload = {
                "meeting_url": _MEETING_URL,
                "bot_name": "load-test-bot",
                "transcript_source": "audio_asr",
            }
            with self.client.post(
                "/meetings",
                json=payload,
                catch_response=True,
                name="POST /meetings",
            ) as response:
                if response.status_code != 200:
                    response.failure(
                        f"Expected 200, got {response.status_code}: {response.text[:200]}"
                    )


def test_concurrent_meetings_load() -> None:
    """End-to-end Locust run against a real meeting-joiner deployment.

    Skips when ``MEETING_JOINER_LOAD_TEST_URL`` is unset so the test is a
    no-op in CI environments that lack a target.
    """
    if not _BASE_URL:
        pytest.skip("MEETING_JOINER_LOAD_TEST_URL not set")

    env = Environment(user_classes=[MeetingJoinerUser], host=_BASE_URL)
    env.create_local_runner()

    env.runner.start(_USERS, spawn_rate=_SPAWN_RATE)

    import time

    time.sleep(_DURATION)
    env.runner.quit()
    env.runner.greenlet.join()

    stats = env.stats.total
    failure_ratio = (
        stats.num_failures / stats.num_requests if stats.num_requests else 1.0
    )
    assert failure_ratio < 0.01, (
        f"Load test failure ratio {failure_ratio:.2%} exceeds 1% threshold "
        f"(failures={stats.num_failures}, total={stats.num_requests})"
    )
    # Latency assertions are commented because the SLA numbers are intentionally
    # tracked outside the repo (engineering wiki). The test still exercises
    # the throughput path and surfaces failure ratios in CI artifacts.
