"""Unit tests for the warm-pool dispatcher.

The dispatcher is the seam between the API handler and (a) the K8s warm
pool, (b) the sidecar HTTP API. We mock both sides because we don't want
unit tests to require a live K8s cluster or sidecar container.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import httpx
import pytest

from src.services.warm_pool_dispatcher import (
    DispatchResult,
    SidecarConfigurePayload,
    dispatch_to_warm_pool,
)
from src.services.warm_pool_manager import ClaimedPod


def _payload() -> SidecarConfigurePayload:
    return SidecarConfigurePayload(
        meeting_id="00000000-0000-0000-0000-000000000001",
        meeting_url="https://teams.microsoft.com/meet/abc",
        org_id="org-1",
        platform="msteams",
        bot_name="Test Bot",
        session_number=1,
        transcript_source="audio_asr",
    )


@pytest.mark.asyncio
@pytest.mark.unit
async def test_dispatch_returns_fallback_when_pool_unavailable() -> None:
    with patch(
        "src.services.warm_pool_dispatcher.get_warm_pool",
        new=AsyncMock(return_value=None),
    ):
        result = await dispatch_to_warm_pool(_payload())

    assert result.success is False
    assert result.fallback_to_queue is True
    assert result.pod_name is None
    assert result.error == "warm_pool_unavailable"


@pytest.mark.asyncio
@pytest.mark.unit
async def test_dispatch_falls_back_when_pool_empty_and_on_demand_at_capacity() -> None:
    """Pool drained AND on-demand at WARM_POOL_MAX → queue fallback (backpressure)."""
    pool = AsyncMock()
    pool.claim_pod = AsyncMock(return_value=None)
    pool.create_and_claim_pod = AsyncMock(return_value=None)

    with patch(
        "src.services.warm_pool_dispatcher.get_warm_pool",
        new=AsyncMock(return_value=pool),
    ):
        result = await dispatch_to_warm_pool(_payload())

    pool.create_and_claim_pod.assert_awaited_once()
    assert result.success is False
    assert result.fallback_to_queue is True
    assert result.error == "warm_pool_empty_and_on_demand_at_capacity"


@pytest.mark.asyncio
@pytest.mark.unit
async def test_dispatch_skips_on_demand_when_disabled() -> None:
    """The inline POST path opts out: empty pool falls straight to the queue."""
    pool = AsyncMock()
    pool.claim_pod = AsyncMock(return_value=None)
    pool.create_and_claim_pod = AsyncMock(return_value=None)

    with patch(
        "src.services.warm_pool_dispatcher.get_warm_pool",
        new=AsyncMock(return_value=pool),
    ):
        result = await dispatch_to_warm_pool(_payload(), allow_on_demand=False)

    pool.create_and_claim_pod.assert_not_awaited()
    assert result.success is False
    assert result.fallback_to_queue is True
    assert result.error == "warm_pool_empty"


@pytest.mark.asyncio
@pytest.mark.unit
async def test_dispatch_uses_on_demand_pod_when_pool_empty() -> None:
    """Pool drained but under capacity → on-demand pod is created and dispatched."""
    on_demand = ClaimedPod(pod_name="meeting-worker-claimed-abc", pod_ip="10.0.0.9")
    pool = AsyncMock()
    pool.claim_pod = AsyncMock(return_value=None)
    pool.create_and_claim_pod = AsyncMock(return_value=on_demand)
    pool.delete_and_replenish = AsyncMock()

    async def fake_post_configure(_pod, _payload):  # noqa: ANN001
        return None  # sidecar accepted

    with patch(
        "src.services.warm_pool_dispatcher.get_warm_pool",
        new=AsyncMock(return_value=pool),
    ), patch(
        "src.services.warm_pool_dispatcher._post_configure",
        new=fake_post_configure,
    ):
        result = await dispatch_to_warm_pool(_payload())

    pool.create_and_claim_pod.assert_awaited_once()
    assert result.success is True
    assert result.fallback_to_queue is False
    assert result.pod_name == "meeting-worker-claimed-abc"
    assert result.pod_ip == "10.0.0.9"


@pytest.mark.asyncio
@pytest.mark.unit
async def test_dispatch_success_path(monkeypatch: pytest.MonkeyPatch) -> None:
    pod = ClaimedPod(pod_name="meeting-worker-abc", pod_ip="10.0.0.1")
    pool = AsyncMock()
    pool.claim_pod = AsyncMock(return_value=pod)
    pool.delete_and_replenish = AsyncMock()

    async def fake_post_configure(_pod, _payload):  # noqa: ANN001
        return None  # success

    with patch(
        "src.services.warm_pool_dispatcher.get_warm_pool",
        new=AsyncMock(return_value=pool),
    ), patch(
        "src.services.warm_pool_dispatcher._post_configure",
        new=fake_post_configure,
    ):
        result = await dispatch_to_warm_pool(_payload())

    assert result.success is True
    assert result.fallback_to_queue is False
    assert result.pod_name == "meeting-worker-abc"
    assert result.pod_ip == "10.0.0.1"
    pool.delete_and_replenish.assert_not_called()


@pytest.mark.asyncio
@pytest.mark.unit
async def test_dispatch_releases_pod_when_sidecar_rejects() -> None:
    pod = ClaimedPod(pod_name="meeting-worker-abc", pod_ip="10.0.0.1")
    pool = AsyncMock()
    pool.claim_pod = AsyncMock(return_value=pod)
    pool.delete_and_replenish = AsyncMock()

    async def failing_post_configure(_pod, _payload):  # noqa: ANN001
        raise httpx.HTTPStatusError(
            "409 conflict",
            request=httpx.Request("POST", "http://10.0.0.1:8080/configure"),
            response=httpx.Response(409),
        )

    with patch(
        "src.services.warm_pool_dispatcher.get_warm_pool",
        new=AsyncMock(return_value=pool),
    ), patch(
        "src.services.warm_pool_dispatcher._post_configure",
        new=failing_post_configure,
    ):
        result = await dispatch_to_warm_pool(_payload())

    assert result.success is False
    # Do NOT fall back to queue — we already claimed and gave up the pod;
    # falling back would have us claim *another* pod which is wasteful.
    assert result.fallback_to_queue is False
    assert result.pod_name == "meeting-worker-abc"
    assert result.release_claim_for_retry is True
    assert result.mark_meeting_failed is False
    pool.delete_and_replenish.assert_awaited_once_with("meeting-worker-abc")


@pytest.mark.asyncio
@pytest.mark.unit
async def test_dispatch_does_not_mark_timeout_as_retry_safe() -> None:
    pod = ClaimedPod(pod_name="meeting-worker-abc", pod_ip="10.0.0.1")
    pool = AsyncMock()
    pool.claim_pod = AsyncMock(return_value=pod)
    pool.delete_and_replenish = AsyncMock()

    async def timing_out_post_configure(_pod, _payload):  # noqa: ANN001
        raise httpx.ReadTimeout(
            "timed out",
            request=httpx.Request("POST", "http://10.0.0.1:8080/configure"),
        )

    with patch(
        "src.services.warm_pool_dispatcher.get_warm_pool",
        new=AsyncMock(return_value=pool),
    ), patch(
        "src.services.warm_pool_dispatcher._post_configure",
        new=timing_out_post_configure,
    ):
        result = await dispatch_to_warm_pool(_payload())

    assert result.success is False
    assert result.fallback_to_queue is False
    assert result.release_claim_for_retry is False
    assert result.mark_meeting_failed is False
    assert result.error is not None
    assert "sidecar_configure_uncertain" in result.error
    pool.delete_and_replenish.assert_awaited_once_with("meeting-worker-abc")


@pytest.mark.asyncio
@pytest.mark.unit
async def test_dispatch_does_not_mark_sidecar_500_as_retry_safe() -> None:
    pod = ClaimedPod(pod_name="meeting-worker-abc", pod_ip="10.0.0.1")
    pool = AsyncMock()
    pool.claim_pod = AsyncMock(return_value=pod)
    pool.delete_and_replenish = AsyncMock()

    async def failing_post_configure(_pod, _payload):  # noqa: ANN001
        raise httpx.HTTPStatusError(
            "500 internal server error",
            request=httpx.Request("POST", "http://10.0.0.1:8080/configure"),
            response=httpx.Response(500),
        )

    with patch(
        "src.services.warm_pool_dispatcher.get_warm_pool",
        new=AsyncMock(return_value=pool),
    ), patch(
        "src.services.warm_pool_dispatcher._post_configure",
        new=failing_post_configure,
    ):
        result = await dispatch_to_warm_pool(_payload())

    assert result.success is False
    assert result.fallback_to_queue is False
    assert result.release_claim_for_retry is False
    assert result.mark_meeting_failed is False
    pool.delete_and_replenish.assert_awaited_once_with("meeting-worker-abc")


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.parametrize("status_code", [422, 503])
async def test_dispatch_does_not_retry_deterministic_sidecar_rejections(
    status_code: int,
) -> None:
    pod = ClaimedPod(pod_name="meeting-worker-abc", pod_ip="10.0.0.1")
    pool = AsyncMock()
    pool.claim_pod = AsyncMock(return_value=pod)
    pool.delete_and_replenish = AsyncMock()

    async def failing_post_configure(_pod, _payload):  # noqa: ANN001
        raise httpx.HTTPStatusError(
            f"{status_code} sidecar rejected",
            request=httpx.Request("POST", "http://10.0.0.1:8080/configure"),
            response=httpx.Response(status_code),
        )

    with patch(
        "src.services.warm_pool_dispatcher.get_warm_pool",
        new=AsyncMock(return_value=pool),
    ), patch(
        "src.services.warm_pool_dispatcher._post_configure",
        new=failing_post_configure,
    ):
        result = await dispatch_to_warm_pool(_payload())

    assert result.success is False
    assert result.fallback_to_queue is False
    assert result.release_claim_for_retry is False
    assert result.mark_meeting_failed is True
    pool.delete_and_replenish.assert_awaited_once_with("meeting-worker-abc")


@pytest.mark.unit
def test_payload_omits_optional_fields_when_none() -> None:
    payload = _payload()
    serialized = payload.to_json()

    # Required fields always present
    for required in (
        "meeting_id",
        "meeting_url",
        "org_id",
        "platform",
        "bot_name",
        "session_number",
    ):
        assert required in serialized

    # Optional fields not present when None
    assert "bot_avatar_url" not in serialized
    assert "webhook_url" not in serialized
    assert "max_duration_seconds" not in serialized


@pytest.mark.unit
def test_payload_includes_optional_fields_when_set() -> None:
    payload = SidecarConfigurePayload(
        meeting_id="m-1",
        meeting_url="https://teams.microsoft.com/x",
        org_id="o-1",
        platform="msteams",
        bot_name="Bot",
        session_number=2,
        webhook_url="https://customer.example.com/webhook",
        max_duration_seconds=3600,
    )
    serialized = payload.to_json()

    assert serialized["webhook_url"] == "https://customer.example.com/webhook"
    assert serialized["max_duration_seconds"] == 3600
    assert serialized["session_number"] == 2


@pytest.mark.unit
def test_dispatch_result_dataclass_is_frozen() -> None:
    result = DispatchResult(
        success=True, pod_name="x", pod_ip="1.1.1.1", fallback_to_queue=False
    )
    with pytest.raises(Exception):  # FrozenInstanceError or AttributeError
        result.success = False  # type: ignore[misc]
