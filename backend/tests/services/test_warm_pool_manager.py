from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from src.services import warm_pool_manager as wpm


def _clear_secret_mapping_env(monkeypatch: pytest.MonkeyPatch) -> None:
    for _, mapping_env_name in wpm.SECRET_KEY_ENV_MAPPINGS:
        monkeypatch.delenv(mapping_env_name, raising=False)
        monkeypatch.delenv(
            wpm.WarmPoolManager._secret_name_env_for_secret_key_env(mapping_env_name),
            raising=False,
        )


def _clear_workload_identity_env(monkeypatch: pytest.MonkeyPatch) -> None:
    for env_name in (
        "MEETING_WORKER_AZURE_WORKLOAD_IDENTITY_ENABLED",
        "AZURE_WORKLOAD_IDENTITY_ENABLED",
        "SANDBOX_AZURE_WORKLOAD_IDENTITY_ENABLED",
    ):
        monkeypatch.delenv(env_name, raising=False)


@pytest.mark.unit
def test_worker_secret_env_from_is_default(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _clear_secret_mapping_env(monkeypatch)
    manager = wpm.WarmPoolManager()

    secret_env = manager._build_secret_key_ref_env_vars()
    env_from = manager._build_shared_env_from()

    assert secret_env == []
    assert len(env_from) == 2
    assert env_from[0].config_map_ref.name == wpm.MEETING_JOINER_CONFIGMAP
    assert env_from[1].secret_ref.name == wpm.MEETING_JOINER_SECRET
    assert env_from[1].secret_ref.optional is True


@pytest.mark.unit
def test_worker_secret_key_refs_when_mappings_are_configured(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _clear_secret_mapping_env(monkeypatch)
    monkeypatch.setenv("DATABASE_URL_SECRET_KEY", "database-url")
    monkeypatch.setenv("AZURE_CLIENT_ID_SECRET_KEY", "azure-client-id")
    monkeypatch.setenv("AZURE_TENANT_ID_SECRET_KEY", "azure-tenant-id")
    monkeypatch.setenv("OPENAI_API_KEY_SECRET_KEY", "openai-api-key")
    monkeypatch.setenv("AZURE_OPENAI_ENDPOINT_SECRET_KEY", "azure-openai-endpoint")
    monkeypatch.setenv("AZURE_SPEECH_AUTH_SECRET_KEY", "azure-speech-auth")
    monkeypatch.setenv("AZURE_STORAGE_AUTH_SECRET_KEY", "azure-storage-auth")
    monkeypatch.setenv(
        "AZURE_STORAGE_ACCOUNT_NAME_SECRET_KEY", "azure-storage-account-name"
    )
    monkeypatch.setenv("S3_BUCKET_NAME_SECRET_KEY", "s3-bucket-name")
    monkeypatch.setenv("AWS_SESSION_TOKEN_SECRET_KEY", "aws-session-token")
    monkeypatch.setenv("ZOOM_CLIENT_SECRET_SECRET_KEY", "zoom-client-secret")
    manager = wpm.WarmPoolManager()

    secret_env = manager._build_secret_key_ref_env_vars()
    env_from = manager._build_shared_env_from()

    assert len(env_from) == 2
    assert env_from[0].config_map_ref.name == wpm.MEETING_JOINER_CONFIGMAP
    assert env_from[1].secret_ref.name == wpm.MEETING_JOINER_SECRET
    assert env_from[1].secret_ref.optional is True

    by_name = {env.name: env for env in secret_env}
    assert set(by_name) == {
        "AZURE_CLIENT_ID",
        "AZURE_OPENAI_ENDPOINT",
        "AZURE_SPEECH_AUTH",
        "AZURE_STORAGE_ACCOUNT_NAME",
        "AZURE_STORAGE_AUTH",
        "AZURE_TENANT_ID",
        "AWS_SESSION_TOKEN",
        "DATABASE_URL",
        "OPENAI_API_KEY",
        "S3_BUCKET_NAME",
        "ZOOM_CLIENT_SECRET",
    }
    assert (
        by_name["AZURE_OPENAI_ENDPOINT"].value_from.secret_key_ref.key
        == "azure-openai-endpoint"
    )
    assert by_name["AZURE_CLIENT_ID"].value_from.secret_key_ref.key == "azure-client-id"
    assert by_name["AZURE_TENANT_ID"].value_from.secret_key_ref.key == "azure-tenant-id"
    assert (
        by_name["AZURE_SPEECH_AUTH"].value_from.secret_key_ref.key
        == "azure-speech-auth"
    )
    assert (
        by_name["AZURE_STORAGE_AUTH"].value_from.secret_key_ref.key
        == "azure-storage-auth"
    )
    assert (
        by_name["AZURE_STORAGE_ACCOUNT_NAME"].value_from.secret_key_ref.key
        == "azure-storage-account-name"
    )
    assert by_name["DATABASE_URL"].value_from.secret_key_ref.key == "database-url"
    assert by_name["OPENAI_API_KEY"].value_from.secret_key_ref.key == "openai-api-key"
    assert (
        by_name["AWS_SESSION_TOKEN"].value_from.secret_key_ref.key
        == "aws-session-token"
    )
    assert by_name["S3_BUCKET_NAME"].value_from.secret_key_ref.key == "s3-bucket-name"
    assert (
        by_name["ZOOM_CLIENT_SECRET"].value_from.secret_key_ref.key
        == "zoom-client-secret"
    )
    assert all(
        env.value_from.secret_key_ref.name == wpm.MEETING_JOINER_SECRET
        for env in secret_env
    )
    assert by_name["DATABASE_URL"].value_from.secret_key_ref.optional is False
    assert all(
        env.value_from.secret_key_ref.optional is True
        for name, env in by_name.items()
        if name != "DATABASE_URL"
    )


@pytest.mark.unit
def test_worker_secret_key_refs_allow_partial_mappings(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _clear_secret_mapping_env(monkeypatch)
    monkeypatch.setenv("OPENAI_API_KEY_SECRET_KEY", "openai-api-key")
    manager = wpm.WarmPoolManager()

    secret_env = manager._build_secret_key_ref_env_vars()

    assert len(secret_env) == 1
    secret_ref = secret_env[0].value_from.secret_key_ref
    assert secret_env[0].name == "OPENAI_API_KEY"
    assert secret_ref.name == wpm.MEETING_JOINER_SECRET
    assert secret_ref.key == "openai-api-key"
    assert secret_ref.optional is True


@pytest.mark.unit
def test_worker_secret_key_refs_allow_per_env_secret_names(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _clear_secret_mapping_env(monkeypatch)
    monkeypatch.setenv("DATABASE_URL_SECRET_KEY", "database-url")
    monkeypatch.setenv("OPENAI_API_KEY_SECRET_KEY", "api-key")
    monkeypatch.setenv("OPENAI_API_KEY_SECRET_NAME", "provider-secret")
    manager = wpm.WarmPoolManager()

    secret_env = manager._build_secret_key_ref_env_vars()
    by_name = {env.name: env for env in secret_env}

    assert by_name["DATABASE_URL"].value_from.secret_key_ref.name == (
        wpm.MEETING_JOINER_SECRET
    )
    assert by_name["DATABASE_URL"].value_from.secret_key_ref.key == "database-url"
    assert (
        by_name["OPENAI_API_KEY"].value_from.secret_key_ref.name == "provider-secret"
    )
    assert by_name["OPENAI_API_KEY"].value_from.secret_key_ref.key == "api-key"


@pytest.mark.asyncio
@pytest.mark.unit
async def test_created_worker_pod_wires_secret_refs_to_both_containers(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _clear_secret_mapping_env(monkeypatch)
    monkeypatch.setenv("DATABASE_URL_SECRET_KEY", "database-url")
    monkeypatch.setenv("OPENAI_API_KEY_SECRET_KEY", "openai-api-key")
    monkeypatch.setenv("OPENAI_API_KEY_SECRET_NAME", "openai-secret")
    monkeypatch.setenv("AZURE_SPEECH_REGION_SECRET_KEY", "azure-speech-region")
    monkeypatch.setenv("AWS_SESSION_TOKEN_SECRET_KEY", "aws-session-token")

    core_api = type("FakeCoreApi", (), {})()
    core_api.create_namespaced_pod = AsyncMock()
    manager = wpm.WarmPoolManager()
    manager._k8s_core_api = core_api

    await manager._create_k8s_pod("meeting-worker-warm-test")

    core_api.create_namespaced_pod.assert_awaited_once()
    pod = core_api.create_namespaced_pod.call_args.kwargs["body"]
    containers = {container.name: container for container in pod.spec.containers}

    for container_name in ("bot-runtime", "sidecar"):
        container = containers[container_name]
        assert container.env_from[0].config_map_ref.name == wpm.MEETING_JOINER_CONFIGMAP
        assert container.env_from[1].secret_ref.name == wpm.MEETING_JOINER_SECRET
        assert container.env_from[1].secret_ref.optional is True

        secret_refs = {
            env.name: env.value_from.secret_key_ref.key
            for env in container.env
            if env.value_from and env.value_from.secret_key_ref
        }
        assert secret_refs["DATABASE_URL"] == "database-url"
        assert secret_refs["OPENAI_API_KEY"] == "openai-api-key"
        assert secret_refs["AZURE_SPEECH_REGION"] == "azure-speech-region"
        assert secret_refs["AWS_SESSION_TOKEN"] == "aws-session-token"
        secret_ref_names = {
            env.name: env.value_from.secret_key_ref.name
            for env in container.env
            if env.value_from and env.value_from.secret_key_ref
        }
        assert secret_ref_names["DATABASE_URL"] == wpm.MEETING_JOINER_SECRET
        assert secret_ref_names["OPENAI_API_KEY"] == "openai-secret"
        assert secret_ref_names["AZURE_SPEECH_REGION"] == wpm.MEETING_JOINER_SECRET
        assert secret_ref_names["AWS_SESSION_TOKEN"] == wpm.MEETING_JOINER_SECRET
        secret_ref_optional = {
            env.name: env.value_from.secret_key_ref.optional
            for env in container.env
            if env.value_from and env.value_from.secret_key_ref
        }
        assert secret_ref_optional["DATABASE_URL"] is False
        assert secret_ref_optional["OPENAI_API_KEY"] is True
        assert secret_ref_optional["AZURE_SPEECH_REGION"] is True
        assert secret_ref_optional["AWS_SESSION_TOKEN"] is True


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.parametrize(
    "env_name",
    (
        "MEETING_WORKER_AZURE_WORKLOAD_IDENTITY_ENABLED",
        "AZURE_WORKLOAD_IDENTITY_ENABLED",
        "SANDBOX_AZURE_WORKLOAD_IDENTITY_ENABLED",
    ),
)
async def test_created_worker_pod_can_opt_into_azure_workload_identity_aliases(
    monkeypatch: pytest.MonkeyPatch,
    env_name: str,
) -> None:
    _clear_secret_mapping_env(monkeypatch)
    _clear_workload_identity_env(monkeypatch)
    monkeypatch.setenv(env_name, "true")

    core_api = type("FakeCoreApi", (), {})()
    core_api.create_namespaced_pod = AsyncMock()
    manager = wpm.WarmPoolManager()
    manager._k8s_core_api = core_api

    await manager._create_k8s_pod("meeting-worker-warm-azure")

    pod = core_api.create_namespaced_pod.call_args.kwargs["body"]
    assert pod.metadata.labels[wpm.AZURE_WORKLOAD_IDENTITY_USE_LABEL] == "true"


@pytest.mark.asyncio
@pytest.mark.unit
async def test_created_worker_pod_leaves_azure_workload_identity_off_by_default(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _clear_secret_mapping_env(monkeypatch)
    _clear_workload_identity_env(monkeypatch)

    core_api = type("FakeCoreApi", (), {})()
    core_api.create_namespaced_pod = AsyncMock()
    manager = wpm.WarmPoolManager()
    manager._k8s_core_api = core_api

    await manager._create_k8s_pod("meeting-worker-warm-no-azure")

    pod = core_api.create_namespaced_pod.call_args.kwargs["body"]
    assert wpm.AZURE_WORKLOAD_IDENTITY_USE_LABEL not in pod.metadata.labels


# =============================================================================
# On-demand burst pods (create_and_claim_pod)
# =============================================================================


def _on_demand_manager(total_active: int) -> wpm.WarmPoolManager:
    """A manager wired with mocked K8s ops for on-demand pod tests."""
    manager = wpm.WarmPoolManager()
    manager._k8s_core_api = type("FakeCoreApi", (), {})()
    manager._scan_pool_state = AsyncMock(  # type: ignore[method-assign]
        return_value=(0, total_active, {}, [])
    )
    manager._create_k8s_pod = AsyncMock()  # type: ignore[method-assign]
    manager._wait_for_pod_ready = AsyncMock(  # type: ignore[method-assign]
        return_value="10.0.0.42"
    )
    manager._verify_pod_health = AsyncMock(  # type: ignore[method-assign]
        return_value=True
    )
    manager._delete_pod = AsyncMock()  # type: ignore[method-assign]
    return manager


@pytest.mark.unit
def test_build_claimed_pod_labels(monkeypatch: pytest.MonkeyPatch) -> None:
    _clear_workload_identity_env(monkeypatch)
    manager = wpm.WarmPoolManager()

    labels = manager._build_claimed_pod_labels("zoom", "meeting-123")

    assert labels["pool"] == "claimed"
    assert labels[wpm.LABEL_STATUS_KEY] == "claimed"
    assert labels["platform"] == "zoom"
    assert labels["meeting-id"] == "meeting-123"
    assert labels["app"] == wpm.LABEL_APP


@pytest.mark.asyncio
@pytest.mark.unit
async def test_create_and_claim_pod_success() -> None:
    manager = _on_demand_manager(total_active=3)

    pod = await manager.create_and_claim_pod(
        meeting_id="meeting-123", platform="msteams"
    )

    assert pod is not None
    assert pod.pod_ip == "10.0.0.42"
    assert pod.pod_name.startswith("meeting-worker-claimed-")
    # The pod is minted already-claimed, not safe-to-evict.
    create_kwargs = manager._create_k8s_pod.call_args.kwargs
    assert create_kwargs["labels"]["pool"] == "claimed"
    assert create_kwargs["labels"]["meeting-id"] == "meeting-123"
    assert create_kwargs["annotations"][wpm.SAFE_TO_EVICT_ANNOTATION] == "false"
    manager._delete_pod.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.unit
async def test_create_and_claim_pod_returns_none_at_capacity() -> None:
    manager = _on_demand_manager(total_active=wpm.WARM_POOL_MAX)

    pod = await manager.create_and_claim_pod(
        meeting_id="meeting-123", platform="msteams"
    )

    assert pod is None
    manager._create_k8s_pod.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.unit
async def test_create_and_claim_pod_rejects_invalid_platform() -> None:
    manager = _on_demand_manager(total_active=0)

    pod = await manager.create_and_claim_pod(
        meeting_id="meeting-123", platform="webex"
    )

    assert pod is None
    manager._scan_pool_state.assert_not_awaited()
    manager._create_k8s_pod.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.unit
async def test_create_and_claim_pod_deletes_pod_on_ready_timeout() -> None:
    manager = _on_demand_manager(total_active=0)
    manager._wait_for_pod_ready = AsyncMock(  # type: ignore[method-assign]
        side_effect=TimeoutError("not ready")
    )

    pod = await manager.create_and_claim_pod(
        meeting_id="meeting-123", platform="googlemeet"
    )

    assert pod is None
    manager._delete_pod.assert_awaited_once()


@pytest.mark.asyncio
@pytest.mark.unit
async def test_create_and_claim_pod_deletes_pod_on_unhealthy_sidecar() -> None:
    manager = _on_demand_manager(total_active=0)
    manager._verify_pod_health = AsyncMock(  # type: ignore[method-assign]
        return_value=False
    )

    pod = await manager.create_and_claim_pod(
        meeting_id="meeting-123", platform="zoom"
    )

    assert pod is None
    manager._delete_pod.assert_awaited_once()
