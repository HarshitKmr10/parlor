"""Warm Pool Manager - K8s-backed warm meeting-worker pod lifecycle.

This manager keeps no in-memory pod/session state. K8s labels are the source
of truth for warm/claimed status.

Ported from an internal sandbox-orchestration codebase's warm-pool primitives
with the following meeting-joiner-specific adaptations:

* Labels: ``app=meeting-worker`` and ``meeting-joiner.parlor.dev/status``
  replace the original sandbox labels.  A ``platform`` label tracks the
  conferencing provider (zoom / msteams / googlemeet / unset) and a
  ``meeting-id`` label is stamped on claim.
* No recycling: ``delete_and_replenish`` replaces ``recycle_pod`` because
  pulseaudio sinks, Xvfb DISPLAY state and Chromium audio context leak across
  sessions and reusing a pod risks audio cross-talk between meetings.
* Reaper semantics: pods are reaped when the sidecar reports
  ``meeting_state == "ended"`` for more than ``ENDED_GRACE_SECONDS`` or
  ``meeting_state == "stuck"`` (heartbeat stale for more than
  ``STUCK_HEARTBEAT_SECONDS``).
* Pod template runs the bot runtime + sidecar containers with the Chromium
  ``/dev/shm`` mount and writable rootfs required by the headless browser.
"""

from __future__ import annotations

import asyncio
import inspect
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

import httpx
from kubernetes_asyncio import client, config
from kubernetes_asyncio.client.exceptions import ApiException
from kubernetes_asyncio.config.config_exception import ConfigException

from src.observability import get_logger

from .k8s_auth import build_authenticated_api_client
from .pod_claim_policy import compute_max_claimable_age_seconds, pod_age_seconds

logger = get_logger(__name__)

# =============================================================================
# Configuration
# =============================================================================

MEETING_NAMESPACE = os.environ.get("MEETING_NAMESPACE", "default")
MEETING_SERVICE_ACCOUNT_NAME = os.environ.get(
    "MEETING_SERVICE_ACCOUNT_NAME", "meeting-worker-sa"
)

# Image defaults use staging ACR -- overridden by ConfigMap in K8s deployment.
MEETING_WORKER_IMAGE = os.environ.get(
    "MEETING_WORKER_IMAGE", "fpaiopsstaging.azurecr.io/meeting-worker:latest"
)
MEETING_SIDECAR_IMAGE = os.environ.get(
    "MEETING_SIDECAR_IMAGE", "fpaiopsstaging.azurecr.io/meeting-sidecar:latest"
)
SIDECAR_PORT = 8080

# Backstop deadline: hard kill after 9h (Teams/Zoom meetings rarely exceed this).
ACTIVE_DEADLINE_SECONDS = int(os.environ.get("ACTIVE_DEADLINE_SECONDS", "32400"))

# Stale-pod protection (see pod_claim_policy.py for the math).
WARM_CLAIM_AGE_BUFFER_SECONDS = int(
    os.environ.get("WARM_CLAIM_AGE_BUFFER_SECONDS", "3600")
)
WARM_MIN_REMAINING_LIFETIME_SECONDS = int(
    os.environ.get("WARM_MIN_REMAINING_LIFETIME_SECONDS", "60")
)

# Reaper thresholds (replace the original sandbox ``IDLE_TIMEOUT_SECONDS``).
ENDED_GRACE_SECONDS = int(os.environ.get("ENDED_GRACE_SECONDS", "60"))
STUCK_HEARTBEAT_SECONDS = int(os.environ.get("STUCK_HEARTBEAT_SECONDS", "90"))

# Priority classes (warm vs claimed).
WARM_PRIORITY_CLASS = os.environ.get(
    "WARM_PRIORITY_CLASS", "meeting-worker-warm"
).strip()
CLAIMED_PRIORITY_CLASS = os.environ.get(
    "CLAIMED_PRIORITY_CLASS", "meeting-worker-claimed"
).strip()

# Pool sizing -- meeting bursts arrive on the hour from calendar joins.
WARM_POOL_SIZE = int(os.environ.get("WARM_POOL_SIZE", "5"))
WARM_POOL_MAX = int(os.environ.get("WARM_POOL_MAX", "50"))
WARM_POOL_REPLENISH_INTERVAL = int(os.environ.get("WARM_POOL_REPLENISH_INTERVAL", "10"))
WARM_POOL_REAPER_INTERVAL = int(os.environ.get("WARM_POOL_REAPER_INTERVAL", "60"))
# On-demand burst pods: when a burst drains the warm pool, dispatch creates a
# dedicated already-claimed pod per meeting instead of serializing behind the
# legacy queue worker. These pods have no pre-warm buffer, so they need a
# longer readiness window than a warm pod (cold image pull on a fresh node).
ON_DEMAND_READY_TIMEOUT_S = int(os.environ.get("ON_DEMAND_READY_TIMEOUT_S", "120"))
REAPER_HEALTH_TIMEOUT = 5  # seconds to wait for /health response

# Resource sizing (env-configurable; defaults sized for headless Chromium).
BOT_RUNTIME_CPU_REQUEST = os.environ.get("BOT_RUNTIME_CPU_REQUEST", "1500m")
BOT_RUNTIME_CPU_LIMIT = os.environ.get("BOT_RUNTIME_CPU_LIMIT", "3000m")
BOT_RUNTIME_MEMORY_REQUEST = os.environ.get("BOT_RUNTIME_MEMORY_REQUEST", "2Gi")
BOT_RUNTIME_MEMORY_LIMIT = os.environ.get("BOT_RUNTIME_MEMORY_LIMIT", "5Gi")

SIDECAR_CPU_REQUEST = os.environ.get("SIDECAR_CPU_REQUEST", "100m")
SIDECAR_CPU_LIMIT = os.environ.get("SIDECAR_CPU_LIMIT", "500m")
SIDECAR_MEMORY_REQUEST = os.environ.get("SIDECAR_MEMORY_REQUEST", "128Mi")
SIDECAR_MEMORY_LIMIT = os.environ.get("SIDECAR_MEMORY_LIMIT", "512Mi")

# Worker pods inherit the API's config via envFrom. Secrets keep the legacy
# envFrom behavior, and explicit secretKeyRef mappings can supplement it when
# the chart needs to reuse an existing Secret whose keys are not valid env
# variable names.
MEETING_JOINER_CONFIGMAP = os.environ.get(
    "MEETING_JOINER_CONFIGMAP", "meeting-joiner-config"
)
MEETING_JOINER_SECRET = os.environ.get(
    "MEETING_JOINER_SECRET", "meeting-joiner-secrets"
)
# Kept for backward compat with anything that still reads it from env.
STORAGE_CREDENTIALS_SECRET = MEETING_JOINER_SECRET
SECRET_KEY_ENV_MAPPINGS: tuple[tuple[str, str], ...] = (
    ("DATABASE_URL", "DATABASE_URL_SECRET_KEY"),
    ("DIRECT_URL", "DIRECT_URL_SECRET_KEY"),
    ("AZURE_CLIENT_ID", "AZURE_CLIENT_ID_SECRET_KEY"),
    ("AZURE_TENANT_ID", "AZURE_TENANT_ID_SECRET_KEY"),
    ("AZURE_AUTHORITY_HOST", "AZURE_AUTHORITY_HOST_SECRET_KEY"),
    ("OPENAI_API_KEY", "OPENAI_API_KEY_SECRET_KEY"),
    ("AZURE_OPENAI_API_KEY", "AZURE_OPENAI_API_KEY_SECRET_KEY"),
    ("AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_ENDPOINT_SECRET_KEY"),
    ("AZURE_OPENAI_API_VERSION", "AZURE_OPENAI_API_VERSION_SECRET_KEY"),
    ("AZURE_OPENAI_DEPLOYMENT", "AZURE_OPENAI_DEPLOYMENT_SECRET_KEY"),
    ("AZURE_SPEECH_AUTH", "AZURE_SPEECH_AUTH_SECRET_KEY"),
    ("AZURE_SPEECH_KEY", "AZURE_SPEECH_KEY_SECRET_KEY"),
    ("AZURE_SPEECH_REGION", "AZURE_SPEECH_REGION_SECRET_KEY"),
    ("AZURE_SPEECH_ENDPOINT", "AZURE_SPEECH_ENDPOINT_SECRET_KEY"),
    ("AZURE_SPEECH_CONTAINER_ENDPOINT", "AZURE_SPEECH_CONTAINER_ENDPOINT_SECRET_KEY"),
    ("AZURE_SPEECH_DEBUG", "AZURE_SPEECH_DEBUG_SECRET_KEY"),
    ("AZURE_SPEECH_DISABLE_CRL_CHECK", "AZURE_SPEECH_DISABLE_CRL_CHECK_SECRET_KEY"),
    (
        "AZURE_SPEECH_SEGMENTATION_SILENCE_TIMEOUT_MS",
        "AZURE_SPEECH_SEGMENTATION_SILENCE_TIMEOUT_MS_SECRET_KEY",
    ),
    ("AZURE_STORAGE_AUTH", "AZURE_STORAGE_AUTH_SECRET_KEY"),
    (
        "AZURE_STORAGE_CONNECTION_STRING",
        "AZURE_STORAGE_CONNECTION_STRING_SECRET_KEY",
    ),
    ("AZURE_STORAGE_ACCOUNT_NAME", "AZURE_STORAGE_ACCOUNT_NAME_SECRET_KEY"),
    ("AZURE_STORAGE_BLOB_ENDPOINT", "AZURE_STORAGE_BLOB_ENDPOINT_SECRET_KEY"),
    ("AZURE_STORAGE_CONTAINER_NAME", "AZURE_STORAGE_CONTAINER_NAME_SECRET_KEY"),
    ("AZURE_AUDIO_CONTAINER_NAME", "AZURE_AUDIO_CONTAINER_NAME_SECRET_KEY"),
    ("AWS_ACCESS_KEY_ID", "AWS_ACCESS_KEY_ID_SECRET_KEY"),
    ("AWS_SECRET_ACCESS_KEY", "AWS_SECRET_ACCESS_KEY_SECRET_KEY"),
    ("AWS_SESSION_TOKEN", "AWS_SESSION_TOKEN_SECRET_KEY"),
    ("AWS_REGION", "AWS_REGION_SECRET_KEY"),
    ("S3_BUCKET_NAME", "S3_BUCKET_NAME_SECRET_KEY"),
    ("ZOOM_CLIENT_ID", "ZOOM_CLIENT_ID_SECRET_KEY"),
    ("ZOOM_CLIENT_SECRET", "ZOOM_CLIENT_SECRET_SECRET_KEY"),
    ("ZOOM_APP_CLIENT_ID", "ZOOM_APP_CLIENT_ID_SECRET_KEY"),
    ("ZOOM_APP_CLIENT_SECRET", "ZOOM_APP_CLIENT_SECRET_SECRET_KEY"),
    ("GOOGLE_ACCOUNT_PASSWORD", "GOOGLE_ACCOUNT_PASSWORD_SECRET_KEY"),
    ("MICROSOFT_APP_PASSWORD", "MICROSOFT_APP_PASSWORD_SECRET_KEY"),
    ("WEBHOOK_SIGNING_SECRET", "WEBHOOK_SIGNING_SECRET_SECRET_KEY"),
    ("CALENDAR_OAUTH_CLIENT_SECRET", "CALENDAR_OAUTH_CLIENT_SECRET_SECRET_KEY"),
    ("SIDECAR_CALLBACK_TOKEN", "SIDECAR_CALLBACK_TOKEN_SECRET_KEY"),
)
REQUIRED_SECRET_KEY_REF_ENV_NAMES = frozenset({"DATABASE_URL"})
MEETING_API_URL = os.environ.get("MEETING_API_URL", "")
STT_PROVIDER = os.environ.get("STT_PROVIDER", "")
MSTEAMS_TRANSCRIPT_SOURCE = os.environ.get("MSTEAMS_TRANSCRIPT_SOURCE", "")
DEPLOYMENT_ENV = os.environ.get("DEPLOYMENT_ENV", "staging")
OTEL_EXPORTER_OTLP_ENDPOINT = os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT", "")
LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO")


# Pod hardening flag (see meetingJoiner.security.runAsNonRoot). Defaults to
# root because that's the only validated configuration; the images are
# non-root-capable but require a rebuild + cluster test before enabling.
RUN_AS_NON_ROOT = os.environ.get("RUN_AS_NON_ROOT", "false").strip().lower() == "true"
RUN_AS_USER = int(os.environ.get("RUN_AS_USER", "1001"))

SAFE_TO_EVICT_ANNOTATION = "cluster-autoscaler.kubernetes.io/safe-to-evict"
AZURE_WORKLOAD_IDENTITY_USE_LABEL = "azure.workload.identity/use"

# Labels (meeting-joiner specific).
LABEL_APP = "meeting-worker"
LABEL_STATUS_KEY = "meeting-joiner.parlor.dev/status"
LABEL_STATUS_KEY_ESCAPED = "meeting-joiner.parlor.dev~1status"
LABEL_PLATFORM_DEFAULT = "unset"
VALID_PLATFORMS = frozenset({"zoom", "msteams", "googlemeet", "unset"})

# K8s API proxy mode (mirrors the original sandbox behaviour for local kind clusters).
_USE_K8S_PROXY = os.environ.get("MEETING_USE_K8S_PROXY", "").lower() == "true"
_K8S_PROXY_URL = os.environ.get(
    "MEETING_K8S_PROXY_URL", "http://localhost:8001"
).rstrip("/")


def _sidecar_url(pod_name: str, pod_ip: str, path: str = "") -> str:
    """Build sidecar URL, optionally routing through kubectl proxy."""
    if _USE_K8S_PROXY:
        return (
            f"{_K8S_PROXY_URL}/api/v1/namespaces/{MEETING_NAMESPACE}"
            f"/pods/{pod_name}:{SIDECAR_PORT}/proxy{path}"
        )
    return f"http://{pod_ip}:{SIDECAR_PORT}{path}"


def _build_bot_runtime_resources() -> client.V1ResourceRequirements:
    """Resource requests/limits for the bot-runtime container."""
    return client.V1ResourceRequirements(
        requests={
            "cpu": BOT_RUNTIME_CPU_REQUEST,
            "memory": BOT_RUNTIME_MEMORY_REQUEST,
        },
        limits={
            "cpu": BOT_RUNTIME_CPU_LIMIT,
            "memory": BOT_RUNTIME_MEMORY_LIMIT,
        },
    )


def _build_sidecar_resources() -> client.V1ResourceRequirements:
    """Resource requests/limits for the sidecar container."""
    return client.V1ResourceRequirements(
        requests={"cpu": SIDECAR_CPU_REQUEST, "memory": SIDECAR_MEMORY_REQUEST},
        limits={"cpu": SIDECAR_CPU_LIMIT, "memory": SIDECAR_MEMORY_LIMIT},
    )


def _pod_field_ref(field_path: str) -> client.V1EnvVarSource:
    """Build a V1EnvVarSource that pulls a pod metadata field via downward API."""
    return client.V1EnvVarSource(
        field_ref=client.V1ObjectFieldSelector(field_path=field_path)
    )


def _parse_iso_timestamp(value: Optional[str]) -> Optional[datetime]:
    """Parse an ISO-8601 timestamp into a tz-aware ``datetime`` (UTC)."""
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


@dataclass(frozen=True)
class ClaimedPod:
    """Result of a successful warm pod claim."""

    pod_name: str
    pod_ip: str


class WarmPoolManager:
    """Manages warm meeting-worker pods using K8s labels as source of truth."""

    def __init__(self) -> None:
        self._k8s_core_api: Optional[client.CoreV1Api] = None
        self._k8s_api_client: Optional[client.ApiClient] = None
        self._k8s_initialized: bool = False
        self._k8s_init_lock: asyncio.Lock = asyncio.Lock()
        self._replenish_task: Optional[asyncio.Task] = None
        self._reaper_task: Optional[asyncio.Task] = None
        self._running: bool = False
        self._lifecycle_lock: asyncio.Lock = asyncio.Lock()

    @staticmethod
    def _env_flag(name: str, default: bool = False) -> bool:
        raw = os.environ.get(name)
        if raw is None or raw == "":
            return default
        return raw.strip().lower() in {"1", "true", "yes", "on"}

    def _azure_workload_identity_enabled(self) -> bool:
        return self._env_flag(
            "MEETING_WORKER_AZURE_WORKLOAD_IDENTITY_ENABLED",
            self._env_flag(
                "AZURE_WORKLOAD_IDENTITY_ENABLED",
                self._env_flag("SANDBOX_AZURE_WORKLOAD_IDENTITY_ENABLED", False),
            ),
        )

    @staticmethod
    def _secret_name_env_for_secret_key_env(mapping_env_name: str) -> str:
        if mapping_env_name.endswith("_SECRET_KEY"):
            return f"{mapping_env_name.removesuffix('_SECRET_KEY')}_SECRET_NAME"
        return f"{mapping_env_name}_SECRET_NAME"

    def _configured_secret_key_mappings(self) -> list[tuple[str, str, str]]:
        """Return configured worker secret mappings.

        Each tuple is ``(env_name, secret_name, secret_key)``.
        """
        mappings: list[tuple[str, str, str]] = []
        for env_name, mapping_env_name in SECRET_KEY_ENV_MAPPINGS:
            secret_key = os.environ.get(mapping_env_name, "").strip()
            if secret_key:
                secret_name = os.environ.get(
                    self._secret_name_env_for_secret_key_env(mapping_env_name),
                    MEETING_JOINER_SECRET,
                ).strip()
                mappings.append(
                    (env_name, secret_name or MEETING_JOINER_SECRET, secret_key)
                )
        return mappings

    def _build_secret_key_ref_env_vars(self) -> list[client.V1EnvVar]:
        """Build explicit secretKeyRef env vars for worker pods.

        Empty mapping config returns an empty list so the caller can keep the
        legacy Secret envFrom path.
        """
        mappings = self._configured_secret_key_mappings()
        if not mappings:
            return []
        return [
            client.V1EnvVar(
                name=env_name,
                value_from=client.V1EnvVarSource(
                    secret_key_ref=client.V1SecretKeySelector(
                        name=secret_name,
                        key=secret_key,
                        optional=env_name not in REQUIRED_SECRET_KEY_REF_ENV_NAMES,
                    )
                ),
            )
            for env_name, secret_name, secret_key in mappings
        ]

    @staticmethod
    def _build_shared_env_from() -> list[client.V1EnvFromSource]:
        """Build shared envFrom sources for worker containers."""
        return [
            client.V1EnvFromSource(
                config_map_ref=client.V1ConfigMapEnvSource(
                    name=MEETING_JOINER_CONFIGMAP,
                    optional=True,
                )
            ),
            client.V1EnvFromSource(
                secret_ref=client.V1SecretEnvSource(
                    name=MEETING_JOINER_SECRET,
                    optional=True,
                )
            ),
        ]

    def _build_worker_pod_labels(self) -> dict[str, str]:
        labels = {
            "app": LABEL_APP,
            "pool": "warm",
            LABEL_STATUS_KEY: "warm",
            "platform": LABEL_PLATFORM_DEFAULT,
        }
        if self._azure_workload_identity_enabled():
            labels[AZURE_WORKLOAD_IDENTITY_USE_LABEL] = "true"
        return labels

    async def _init_k8s(self) -> None:
        """Initialize K8s client (idempotent)."""
        if self._k8s_initialized:
            return
        async with self._k8s_init_lock:
            if self._k8s_initialized:
                return
            try:
                maybe_config = config.load_incluster_config()
                if inspect.isawaitable(maybe_config):
                    await maybe_config
                logger.info("warm_pool.k8s_config_loaded", source="in_cluster")
            except ConfigException:
                try:
                    maybe_config = config.load_kube_config()
                    if inspect.isawaitable(maybe_config):
                        await maybe_config
                    logger.info("warm_pool.k8s_config_loaded", source="kubeconfig")
                except ConfigException as e:
                    logger.error("warm_pool.k8s_config_failed", error=str(e))
                    raise RuntimeError("K8s configuration failed")

            self._k8s_api_client = build_authenticated_api_client()
            self._k8s_core_api = client.CoreV1Api(self._k8s_api_client)
            self._k8s_initialized = True

    # =========================================================================
    # Lifecycle
    # =========================================================================

    async def start(self) -> None:
        """Start background replenish + reaper loops (idempotent)."""
        await self._init_k8s()
        started = False
        async with self._lifecycle_lock:
            replenish_running = (
                self._replenish_task is not None and not self._replenish_task.done()
            )
            reaper_running = (
                self._reaper_task is not None and not self._reaper_task.done()
            )
            if self._running and replenish_running and reaper_running:
                return

            self._running = True
            if not replenish_running:
                self._replenish_task = asyncio.create_task(self._replenish_loop())
                started = True
            if not reaper_running:
                self._reaper_task = asyncio.create_task(self._reaper_loop())
                started = True

        if started:
            logger.info(
                "warm_pool.started",
                target_size=WARM_POOL_SIZE,
                max_size=WARM_POOL_MAX,
                ended_grace_seconds=ENDED_GRACE_SECONDS,
                stuck_heartbeat_seconds=STUCK_HEARTBEAT_SECONDS,
            )

    async def stop(self) -> None:
        """Stop background tasks (idempotent)."""
        async with self._lifecycle_lock:
            self._running = False
            tasks = [t for t in (self._replenish_task, self._reaper_task) if t]
            self._replenish_task = None
            self._reaper_task = None

        for task in tasks:
            task.cancel()
        for task in tasks:
            try:
                await task
            except asyncio.CancelledError:
                pass
            except Exception as e:
                logger.warning("warm_pool.background_task_stop_error", error=str(e))
        await self._close_k8s_client()
        logger.info("warm_pool.stopped")

    async def _close_k8s_client(self) -> None:
        """Close Kubernetes ApiClient to avoid unclosed aiohttp session warnings."""
        api_client = self._k8s_api_client
        self._k8s_api_client = None
        self._k8s_core_api = None
        self._k8s_initialized = False
        if api_client is None:
            return
        try:
            await api_client.close()
        except Exception as e:
            logger.warning("warm_pool.k8s_client_close_error", error=str(e))

    # =========================================================================
    # Pod Operations
    # =========================================================================

    async def claim_pod(self, meeting_id: str, platform: str) -> Optional[ClaimedPod]:
        """Claim a warm pod via K8s labels.

        Iterates Running warm pods and attempts an atomic compare-and-swap
        (JSON Patch with resourceVersion test) to transition warm -> claimed.
        On success, stamps the pod with the meeting-id and platform labels and
        upgrades the priority class annotation.

        Pods that are too old, unhealthy, or concurrently claimed are skipped.

        Returns ``ClaimedPod(pod_name, pod_ip)`` on success, ``None`` otherwise.
        """
        if not self._k8s_core_api:
            return None
        if platform not in VALID_PLATFORMS:
            logger.warning(
                "warm_pool.invalid_platform",
                platform=platform,
                meeting_id=meeting_id,
            )
            return None

        max_claimable_age = compute_max_claimable_age_seconds(
            active_deadline_seconds=ACTIVE_DEADLINE_SECONDS,
            claim_age_buffer_seconds=WARM_CLAIM_AGE_BUFFER_SECONDS,
            min_remaining_lifetime_seconds=WARM_MIN_REMAINING_LIFETIME_SECONDS,
        )

        try:
            pods = await self._k8s_core_api.list_namespaced_pod(
                namespace=MEETING_NAMESPACE,
                label_selector=(f"app={LABEL_APP},pool=warm,{LABEL_STATUS_KEY}=warm"),
            )
        except Exception as e:
            logger.warning("warm_pool.list_warm_failed", error=str(e))
            return None

        for pod in pods.items:
            if pod.status.phase != "Running" or not pod.status.pod_ip:
                continue
            if not pod.status.container_statuses or not all(
                cs.ready for cs in pod.status.container_statuses
            ):
                continue
            age_seconds = pod_age_seconds(pod.metadata.creation_timestamp)
            if age_seconds is not None and age_seconds >= max_claimable_age:
                logger.info(
                    "warm_pool.skip_stale_pod",
                    pod_name=pod.metadata.name,
                    age_seconds=age_seconds,
                    deadline_seconds=ACTIVE_DEADLINE_SECONDS,
                )
                continue

            pod_name = pod.metadata.name
            pod_ip = pod.status.pod_ip
            resource_version = pod.metadata.resource_version
            if not await self._verify_pod_health(pod_name, pod_ip):
                continue

            if not resource_version:
                logger.warning("warm_pool.missing_resource_version", pod_name=pod_name)
                continue

            try:
                await self._k8s_core_api.patch_namespaced_pod(
                    name=pod_name,
                    namespace=MEETING_NAMESPACE,
                    body=[
                        {
                            "op": "test",
                            "path": "/metadata/resourceVersion",
                            "value": resource_version,
                        },
                        {
                            "op": "test",
                            "path": "/metadata/labels/pool",
                            "value": "warm",
                        },
                        {
                            "op": "test",
                            "path": f"/metadata/labels/{LABEL_STATUS_KEY_ESCAPED}",
                            "value": "warm",
                        },
                        {
                            "op": "replace",
                            "path": "/metadata/labels/pool",
                            "value": "claimed",
                        },
                        {
                            "op": "replace",
                            "path": f"/metadata/labels/{LABEL_STATUS_KEY_ESCAPED}",
                            "value": "claimed",
                        },
                        {
                            "op": "replace",
                            "path": "/metadata/labels/platform",
                            "value": platform,
                        },
                        {
                            "op": "add",
                            "path": "/metadata/labels/meeting-id",
                            "value": meeting_id,
                        },
                    ],
                )
                try:
                    await self._k8s_core_api.patch_namespaced_pod(
                        name=pod_name,
                        namespace=MEETING_NAMESPACE,
                        body={
                            "metadata": {
                                "annotations": {
                                    SAFE_TO_EVICT_ANNOTATION: "false",
                                }
                            }
                        },
                    )
                except Exception as annotation_error:
                    logger.warning(
                        "warm_pool.evict_annotation_failed",
                        pod_name=pod_name,
                        error=str(annotation_error),
                    )
                logger.info(
                    "warm_pool.pod_claimed",
                    pod_name=pod_name,
                    meeting_id=meeting_id,
                    platform=platform,
                )
                return ClaimedPod(pod_name=pod_name, pod_ip=pod_ip)
            except ApiException as e:
                if e.status in {409, 422}:
                    logger.info(
                        "warm_pool.concurrent_claim",
                        pod_name=pod_name,
                        status=e.status,
                    )
                else:
                    logger.warning(
                        "warm_pool.claim_failed",
                        pod_name=pod_name,
                        status=e.status,
                    )

        logger.warning(
            "warm_pool.no_warm_pods_available",
            meeting_id=meeting_id,
            platform=platform,
        )
        return None

    async def delete_and_replenish(self, pod_name: str) -> None:
        """Delete a pod outright; the replenish loop will create a replacement.

        Replaces the original sandbox ``recycle_pod`` flow.  Reusing a pod across
        meetings risks pulseaudio/Xvfb/Chromium state leakage and audio
        cross-talk, so we always tear down and re-create.
        """
        if not self._k8s_core_api:
            return
        logger.info("warm_pool.delete_and_replenish", pod_name=pod_name)
        await self._delete_pod(pod_name)

    async def _create_warm_pod(self) -> Optional[str]:
        """Create and wait for a warm pod."""
        if not self._k8s_core_api:
            return None

        pod_name = f"meeting-worker-warm-{uuid4().hex[:8]}"
        logger.info("warm_pool.creating_warm_pod", pod_name=pod_name)
        try:
            await self._create_k8s_pod(pod_name)
            await self._wait_for_pod_ready(pod_name)
            logger.info("warm_pool.warm_pod_ready", pod_name=pod_name)
            return pod_name
        except Exception as e:
            logger.error(
                "warm_pool.warm_pod_create_failed", pod_name=pod_name, error=str(e)
            )
            await self._delete_pod(pod_name)
            return None

    def _build_claimed_pod_labels(
        self, platform: str, meeting_id: str
    ) -> dict[str, str]:
        """Labels for an on-demand pod that is born already claimed.

        Mirrors the warm->claimed label transition in :meth:`claim_pod` so the
        ghost-pod reaper and rejoin orchestrator treat on-demand pods exactly
        like a claimed warm pod.
        """
        labels = {
            "app": LABEL_APP,
            "pool": "claimed",
            LABEL_STATUS_KEY: "claimed",
            "platform": platform,
            "meeting-id": meeting_id,
        }
        if self._azure_workload_identity_enabled():
            labels[AZURE_WORKLOAD_IDENTITY_USE_LABEL] = "true"
        return labels

    async def create_and_claim_pod(
        self, meeting_id: str, platform: str
    ) -> Optional[ClaimedPod]:
        """Burst overflow: create a dedicated pod already claimed for a meeting.

        When :meth:`claim_pod` finds the warm pool drained, dispatch calls this
        instead of surrendering to the (serial, one-meeting-per-pod) queue
        worker. The pod is created with claimed labels, waited to Ready, and
        health-checked — then handed back exactly like a warm claim.

        Bounded by ``WARM_POOL_MAX`` total active pods so a runaway burst can't
        exhaust the cluster. Returns ``None`` at capacity (caller falls back to
        the queue) or on any create/readiness failure. The capacity check is a
        soft cap: with multiple API replicas a concurrent burst may briefly
        overshoot ``WARM_POOL_MAX``, which the warm replenisher already tolerates.
        """
        if not self._k8s_core_api:
            return None
        if platform not in VALID_PLATFORMS:
            logger.warning(
                "warm_pool.on_demand_invalid_platform",
                platform=platform,
                meeting_id=meeting_id,
            )
            return None

        _, total_active, _, _ = await self._scan_pool_state()
        if total_active >= WARM_POOL_MAX:
            logger.warning(
                "warm_pool.on_demand_at_capacity",
                meeting_id=meeting_id,
                total_active=total_active,
                max_size=WARM_POOL_MAX,
            )
            return None

        pod_name = f"meeting-worker-claimed-{uuid4().hex[:8]}"
        logger.info(
            "warm_pool.creating_on_demand_pod",
            pod_name=pod_name,
            meeting_id=meeting_id,
            platform=platform,
        )
        try:
            await self._create_k8s_pod(
                pod_name,
                labels=self._build_claimed_pod_labels(platform, meeting_id),
                annotations={SAFE_TO_EVICT_ANNOTATION: "false"},
                priority_class_name=CLAIMED_PRIORITY_CLASS or None,
            )
            pod_ip = await self._wait_for_pod_ready(
                pod_name, timeout=ON_DEMAND_READY_TIMEOUT_S
            )
        except Exception as e:
            logger.error(
                "warm_pool.on_demand_create_failed",
                pod_name=pod_name,
                meeting_id=meeting_id,
                error=str(e),
            )
            await self._delete_pod(pod_name)
            return None

        if not await self._verify_pod_health(pod_name, pod_ip):
            logger.warning(
                "warm_pool.on_demand_health_failed",
                pod_name=pod_name,
                meeting_id=meeting_id,
            )
            await self._delete_pod(pod_name)
            return None

        logger.info(
            "warm_pool.on_demand_pod_claimed",
            pod_name=pod_name,
            meeting_id=meeting_id,
            platform=platform,
        )
        return ClaimedPod(pod_name=pod_name, pod_ip=pod_ip)

    async def _create_k8s_pod(
        self,
        pod_name: str,
        *,
        labels: Optional[dict[str, str]] = None,
        annotations: Optional[dict[str, str]] = None,
        priority_class_name: Optional[str] = None,
    ) -> None:
        """Create a K8s meeting-worker pod (bot-runtime + sidecar containers).

        Defaults produce a *warm* pod (pool=warm, safe-to-evict, warm priority).
        The on-demand burst path overrides ``labels``/``annotations``/
        ``priority_class_name`` to mint a pod that is born already-claimed for a
        specific meeting, so it skips the warm->claimed compare-and-swap.
        """
        if not self._k8s_core_api:
            raise RuntimeError("K8s API not initialized")

        pod_labels = labels if labels is not None else self._build_worker_pod_labels()
        pod_annotations = (
            annotations
            if annotations is not None
            else {SAFE_TO_EVICT_ANNOTATION: "true"}
        )
        pod_priority_class = (
            priority_class_name
            if priority_class_name is not None
            else (WARM_PRIORITY_CLASS or None)
        )

        shared_volume_mounts = [
            client.V1VolumeMount(name="workspace", mount_path="/workspace"),
            client.V1VolumeMount(name="tmp", mount_path="/tmp"),
            client.V1VolumeMount(name="dshm", mount_path="/dev/shm"),
        ]

        pod_volumes = [
            client.V1Volume(
                name="workspace", empty_dir=client.V1EmptyDirVolumeSource()
            ),
            client.V1Volume(
                name="tmp",
                empty_dir=client.V1EmptyDirVolumeSource(size_limit="1Gi"),
            ),
            client.V1Volume(
                name="dshm",
                empty_dir=client.V1EmptyDirVolumeSource(
                    medium="Memory", size_limit="256Mi"
                ),
            ),
        ]

        shared_observability_env = [
            client.V1EnvVar(
                name="OTEL_EXPORTER_OTLP_ENDPOINT",
                value=OTEL_EXPORTER_OTLP_ENDPOINT,
            ),
            client.V1EnvVar(name="LOG_LEVEL", value=LOG_LEVEL),
            client.V1EnvVar(name="DEPLOYMENT_ENV", value=DEPLOYMENT_ENV),
            client.V1EnvVar(
                name="POD_NAME", value_from=_pod_field_ref("metadata.name")
            ),
            client.V1EnvVar(
                name="POD_NAMESPACE",
                value_from=_pod_field_ref("metadata.namespace"),
            ),
        ]

        # Backward compatible secret handling:
        # - Secret envFrom keeps legacy uppercase Secret keys working.
        # - explicit refs let deployments map non-env-style Secret keys to the
        #   env vars required by the worker runtime.
        secret_key_ref_env = self._build_secret_key_ref_env_vars()
        shared_env_from = self._build_shared_env_from()

        # Pod hardening — opt-in via RUN_AS_NON_ROOT (injected from
        # meetingJoiner.security.runAsNonRoot). The worker image is now
        # non-root-capable (uid 1001, Playwright cache relocated to
        # /opt/ms-playwright — see RCA #22), but this defaults to root
        # because that's the only validated configuration. Flip the chart
        # flag to true only after rebuilding + verifying the image.
        if RUN_AS_NON_ROOT:
            _bot_security_ctx = client.V1SecurityContext(
                run_as_user=RUN_AS_USER,
                run_as_non_root=True,
                allow_privilege_escalation=False,
            )
        else:
            _bot_security_ctx = client.V1SecurityContext(
                run_as_user=0,
                run_as_non_root=False,
                allow_privilege_escalation=True,
            )

        bot_runtime_container = client.V1Container(
            name="bot-runtime",
            image=MEETING_WORKER_IMAGE,
            # RCA #23: pod spec referenced /usr/local/bin/start-bot-runtime.sh
            # but the Dockerfile leaves the script under src/bot/. Use the
            # actual in-image path until the Dockerfile is fixed to install
            # the script into PATH.
            command=["sh", "/app/meeting-joiner/src/bot/start-bot-runtime.sh"],
            security_context=_bot_security_ctx,
            resources=_build_bot_runtime_resources(),
            volume_mounts=shared_volume_mounts,
            env_from=shared_env_from,
            env=[
                *shared_observability_env,
                *secret_key_ref_env,
                client.V1EnvVar(name="OTEL_SERVICE_NAME", value="meeting-worker-bot"),
                # CHROME_BIN is intentionally NOT hardcoded here. The worker
                # image sets a correct per-arch default (ENV CHROME_BIN=
                # /usr/bin/google-chrome on amd64); deployers needing the
                # Playwright-bundled Chromium (e.g. arm64) override it via the
                # meeting-joiner-config ConfigMap, which is injected through
                # env_from above. A pinned chromium-<build> path here breaks
                # on every Playwright upgrade and is wrong on amd64.
            ],
        )

        # RCA #28: The bundled sidecar image is python:3.11-slim and lacks
        # node + the bot source — so /configure → bot_supervisor.spawn
        # fails with FileNotFoundError when it tries to exec
        # `node /app/.../joinMeeting.js`. The sidecar must run alongside
        # the bot's runtime files. Use the worker image (which has node +
        # the bot source baked in) and explicitly override the command to
        # launch the sidecar's uvicorn server.
        sidecar_container = client.V1Container(
            name="sidecar",
            image=MEETING_WORKER_IMAGE,
            command=[
                "python3",
                "-m",
                "uvicorn",
                "src.sidecar.main:app",
                "--host",
                "0.0.0.0",
                "--port",
                str(SIDECAR_PORT),
                "--no-access-log",
            ],
            working_dir="/app/meeting-joiner",
            ports=[client.V1ContainerPort(container_port=SIDECAR_PORT)],
            security_context=_bot_security_ctx,
            resources=_build_sidecar_resources(),
            volume_mounts=shared_volume_mounts,
            env_from=shared_env_from,
            env=[
                *shared_observability_env,
                *secret_key_ref_env,
                client.V1EnvVar(
                    name="OTEL_SERVICE_NAME", value="meeting-worker-sidecar"
                ),
            ],
            readiness_probe=client.V1Probe(
                http_get=client.V1HTTPGetAction(path="/health", port=SIDECAR_PORT),
                initial_delay_seconds=2,
                period_seconds=5,
            ),
            liveness_probe=client.V1Probe(
                http_get=client.V1HTTPGetAction(path="/health", port=SIDECAR_PORT),
                initial_delay_seconds=30,
                period_seconds=30,
                failure_threshold=3,
            ),
        )

        pod = client.V1Pod(
            metadata=client.V1ObjectMeta(
                name=pod_name,
                namespace=MEETING_NAMESPACE,
                labels=pod_labels,
                annotations=pod_annotations,
            ),
            spec=client.V1PodSpec(
                share_process_namespace=True,
                automount_service_account_token=False,
                service_account_name=MEETING_SERVICE_ACCOUNT_NAME,
                restart_policy="Never",
                enable_service_links=False,
                active_deadline_seconds=ACTIVE_DEADLINE_SECONDS,
                termination_grace_period_seconds=60,
                priority_class_name=pod_priority_class,
                containers=[bot_runtime_container, sidecar_container],
                volumes=pod_volumes,
            ),
        )
        await self._k8s_core_api.create_namespaced_pod(
            namespace=MEETING_NAMESPACE, body=pod
        )

    async def _wait_for_pod_ready(self, pod_name: str, timeout: int = 60) -> str:
        """Wait for pod to be ready and return pod IP."""
        if not self._k8s_core_api:
            raise RuntimeError("K8s API not initialized")

        start_time = asyncio.get_event_loop().time()
        while True:
            try:
                pod = await self._k8s_core_api.read_namespaced_pod(
                    name=pod_name,
                    namespace=MEETING_NAMESPACE,
                )
                if pod.status.phase == "Running" and pod.status.pod_ip:
                    if pod.status.container_statuses and all(
                        cs.ready for cs in pod.status.container_statuses
                    ):
                        return pod.status.pod_ip
                if pod.status.phase in ("Failed", "Succeeded"):
                    raise RuntimeError(f"Pod {pod_name} terminated: {pod.status.phase}")
            except ApiException as e:
                if e.status != 404:
                    raise

            if asyncio.get_event_loop().time() - start_time > timeout:
                raise TimeoutError(f"Pod {pod_name} not ready after {timeout}s")
            await asyncio.sleep(1)

    async def _delete_pod(self, pod_name: str) -> None:
        """Delete a pod (best effort)."""
        if not self._k8s_core_api:
            return
        try:
            await self._k8s_core_api.delete_namespaced_pod(
                name=pod_name,
                namespace=MEETING_NAMESPACE,
                body=client.V1DeleteOptions(grace_period_seconds=60),
            )
        except ApiException as e:
            if e.status != 404:
                logger.error(
                    "warm_pool.delete_pod_failed",
                    pod_name=pod_name,
                    status=e.status,
                )

    async def _verify_pod_health(self, pod_name: str, pod_ip: str) -> bool:
        """Check if sidecar health endpoint is reachable."""
        try:
            async with httpx.AsyncClient(timeout=5) as http:
                response = await http.get(_sidecar_url(pod_name, pod_ip, "/health"))
                return response.status_code == 200
        except Exception:
            return False

    async def abort_meeting_pod(
        self,
        pod_name: str,
        reason: str = "user_stop",
        grace_seconds: int = 10,
    ) -> bool:
        """Stop the bot on a claimed pod, then delete the pod.

        In the warm-pool model the bot runs inside the sidecar's subprocess, so
        the ONLY way to make it leave the meeting is to call the sidecar's
        /abort (which SIGTERMs the bot for a graceful leave + transcript flush).
        Used by the API stop endpoint — the legacy bridge has no handle to a
        sidecar-spawned bot. The API pod is the only client the worker's
        NetworkPolicy lets reach :8080, so this call must originate here.

        Returns True if the sidecar acknowledged the abort. The pod is deleted
        afterwards regardless so a stopped meeting's pod never lingers; the warm
        pool replenishes the standby.
        """
        if not self._k8s_core_api:
            return False
        pod_ip = None
        try:
            pod = await self._k8s_core_api.read_namespaced_pod(
                name=pod_name, namespace=MEETING_NAMESPACE
            )
            pod_ip = pod.status.pod_ip if pod and pod.status else None
        except ApiException as e:
            if e.status != 404:
                logger.warning(
                    "warm_pool.abort_pod_read_failed",
                    pod_name=pod_name,
                    status=e.status,
                )

        acked = False
        if pod_ip:
            try:
                async with httpx.AsyncClient(timeout=grace_seconds + 5) as http:
                    resp = await http.post(
                        _sidecar_url(pod_name, pod_ip, "/abort"),
                        json={"reason": reason, "grace_seconds": grace_seconds},
                    )
                    acked = resp.status_code in (200, 202)
            except Exception as e:  # noqa: BLE001
                logger.warning(
                    "warm_pool.abort_pod_failed", pod_name=pod_name, error=str(e)
                )

        await self._delete_pod(pod_name)
        logger.info(
            "warm_pool.meeting_pod_aborted",
            pod_name=pod_name,
            reason=reason,
            sidecar_ack=acked,
        )
        return acked

    # =========================================================================
    # Background Tasks
    # =========================================================================

    async def _replenish_loop(self) -> None:
        """Background task to maintain warm pool size."""
        while self._running:
            try:
                await self._replenish()
            except Exception as e:
                logger.error("warm_pool.replenish_error", error=str(e))
            await asyncio.sleep(WARM_POOL_REPLENISH_INTERVAL)

    async def _scan_pool_state(
        self,
    ) -> tuple[int, int, dict[str, int], list[str]]:
        """Scan all meeting-worker pods and classify them.

        Returns:
            warm_count:   Ready warm pods young enough to claim.
            total_active: All Pending/Running pods (warm + claimed).
            by_state:     Breakdown by ``meeting-joiner.parlor.dev/status``.
            stale_pods:   Warm pod names past the max claimable age.
        """
        if not self._k8s_core_api:
            return (0, 0, {}, [])
        try:
            pods = await self._k8s_core_api.list_namespaced_pod(
                namespace=MEETING_NAMESPACE,
                label_selector=f"app={LABEL_APP}",
            )
        except Exception as e:
            logger.warning("warm_pool.list_pods_failed", error=str(e))
            return (0, 0, {}, [])

        max_claimable_age = compute_max_claimable_age_seconds(
            active_deadline_seconds=ACTIVE_DEADLINE_SECONDS,
            claim_age_buffer_seconds=WARM_CLAIM_AGE_BUFFER_SECONDS,
            min_remaining_lifetime_seconds=WARM_MIN_REMAINING_LIFETIME_SECONDS,
        )
        warm_count = 0
        total_active = 0
        by_state: dict[str, int] = {}
        stale_pods: list[str] = []
        for pod in pods.items:
            labels = pod.metadata.labels or {}
            phase = pod.status.phase
            status = labels.get(LABEL_STATUS_KEY) or "unknown"
            by_state[status] = by_state.get(status, 0) + 1

            if phase in {"Pending", "Running"}:
                total_active += 1

            is_warm = (
                labels.get("pool") == "warm"
                and labels.get(LABEL_STATUS_KEY) == "warm"
                and phase == "Running"
            )
            if (
                is_warm
                and pod.status.container_statuses
                and all(cs.ready for cs in pod.status.container_statuses)
            ):
                age_seconds = pod_age_seconds(pod.metadata.creation_timestamp)
                if age_seconds is not None and age_seconds >= max_claimable_age:
                    stale_pods.append(pod.metadata.name)
                    continue
                warm_count += 1

        return (warm_count, total_active, by_state, stale_pods)

    async def _get_pool_counts(self) -> tuple[int, int, dict[str, int]]:
        """Return ``(warm_count, total_active, by_state)`` from K8s labels."""
        warm_count, total_active, by_state, _ = await self._scan_pool_state()
        return (warm_count, total_active, by_state)

    async def _replenish(self) -> None:
        """Replenish warm pool to target size.

        Two-phase approach:
        1. Delete stale warm pods (past max claimable age) so they stop
           occupying slots in the pool and K8s resources.
        2. Create fresh pods to bring ``warm_count`` back to
           ``WARM_POOL_SIZE``, capped by ``WARM_POOL_MAX`` total active pods.
        """
        warm_count, total_active, _, stale_pods = await self._scan_pool_state()
        max_claimable_age = compute_max_claimable_age_seconds(
            active_deadline_seconds=ACTIVE_DEADLINE_SECONDS,
            claim_age_buffer_seconds=WARM_CLAIM_AGE_BUFFER_SECONDS,
            min_remaining_lifetime_seconds=WARM_MIN_REMAINING_LIFETIME_SECONDS,
        )
        for pod_name in stale_pods:
            try:
                logger.info(
                    "warm_pool.delete_stale_pod",
                    pod_name=pod_name,
                    max_claimable_age=max_claimable_age,
                )
                await self._k8s_core_api.delete_namespaced_pod(
                    name=pod_name,
                    namespace=MEETING_NAMESPACE,
                    body=client.V1DeleteOptions(grace_period_seconds=0),
                )
            except Exception as e:
                logger.warning(
                    "warm_pool.delete_stale_failed",
                    pod_name=pod_name,
                    error=str(e),
                )

        pods_to_create = min(
            max(WARM_POOL_SIZE - warm_count, 0),
            max(WARM_POOL_MAX - total_active, 0),
        )
        if pods_to_create > 0:
            logger.info(
                "warm_pool.replenishing",
                pods_to_create=pods_to_create,
                warm_count=warm_count,
                total_active=total_active,
                target=WARM_POOL_SIZE,
            )
            tasks = [self._create_warm_pod() for _ in range(pods_to_create)]
            await asyncio.gather(*tasks, return_exceptions=True)

    # =========================================================================
    # Reaper (ended / stuck detection)
    # =========================================================================

    async def _reaper_loop(self) -> None:
        """Background task to reap ended or stuck claimed pods."""
        while self._running:
            try:
                await self._reap_dead_pods()
            except Exception as e:
                logger.error("warm_pool.reaper_error", error=str(e))
            await asyncio.sleep(WARM_POOL_REAPER_INTERVAL)

    async def _reap_dead_pods(self) -> None:
        """Check all claimed pods for ended/stuck states and reap them.

        Uses a double-check pattern: first pass identifies candidates, sleeps
        5s, then re-checks each candidate.  This prevents false positives from
        transient health-endpoint delays.
        """
        if not self._k8s_core_api:
            return
        try:
            pods = await self._k8s_core_api.list_namespaced_pod(
                namespace=MEETING_NAMESPACE,
                label_selector=f"app={LABEL_APP},{LABEL_STATUS_KEY}=claimed",
            )
        except Exception as e:
            logger.warning("warm_pool.reaper.list_claimed_failed", error=str(e))
            return

        claimed_pods = [
            (pod.metadata.name, pod.status.pod_ip)
            for pod in pods.items
            if pod.status.phase == "Running" and pod.status.pod_ip
        ]
        if not claimed_pods:
            return

        candidates: list[tuple[str, str, str]] = []
        for pod_name, pod_ip in claimed_pods:
            try:
                reason = await self._classify_pod_for_reap(pod_name, pod_ip)
                if reason is not None:
                    candidates.append((pod_name, pod_ip, reason))
            except Exception as e:
                logger.warning(
                    "warm_pool.reaper.classify_error",
                    pod_name=pod_name,
                    error=str(e),
                )

        if not candidates:
            return

        await asyncio.sleep(5)

        for pod_name, pod_ip, first_reason in candidates:
            try:
                second_reason = await self._classify_pod_for_reap(pod_name, pod_ip)
                if second_reason is None:
                    continue
                logger.info(
                    "warm_pool.reaper.reaping_pod",
                    pod_name=pod_name,
                    first_reason=first_reason,
                    confirmed_reason=second_reason,
                )
                # Drive the orchestrator for BOTH states before deleting the
                # pod. The intended `/internal/sessions/ended` callback is NOT
                # actually wired anywhere, so for "ended" we must transition
                # the meeting here too — otherwise it lingers `ongoing` until
                # the slow hourly cleanup (and the pod we're about to delete
                # leaves the meeting orphaned). The orchestrator closes the
                # session and either completes/fails the meeting (terminal
                # exit) or rejoins it (recoverable exit).
                if second_reason == "stuck":
                    await self._trigger_rejoin_for_pod(
                        pod_name, exit_reason="stuck_no_heartbeat"
                    )
                elif second_reason == "ended":
                    # exit_reason=None → use the reason the bot recorded on the
                    # meeting row (e.g. left_alone_timeout, removed, trackGone).
                    await self._trigger_rejoin_for_pod(pod_name, exit_reason=None)
                await self._delete_pod(pod_name)
            except Exception as e:
                logger.warning(
                    "warm_pool.reaper.confirm_error",
                    pod_name=pod_name,
                    error=str(e),
                )

    async def _trigger_rejoin_for_pod(
        self, pod_name: str, *, exit_reason: Optional[str] = None
    ) -> None:
        """Fire RejoinOrchestrator for the meeting attached to ``pod_name``.

        Pulls the ``meeting-id`` label off the pod (stamped at claim time in
        :meth:`claim_pod`). Lazy-imports the orchestrator to avoid a circular
        dependency — orchestrator → dispatcher → warm pool manager.
        Best-effort: any failure logs and continues so a broken rejoin path
        never blocks pod cleanup.

        ``exit_reason=None`` (used for cleanly-ended pods) means "use the
        exit_reason the bot already recorded on the meeting row", falling back
        to ``exited_clean`` (a terminal → completed reason) if none is set.
        """
        if not self._k8s_core_api:
            return
        try:
            pod = await self._k8s_core_api.read_namespaced_pod(
                name=pod_name, namespace=MEETING_NAMESPACE
            )
            labels = pod.metadata.labels or {}
            meeting_id = labels.get("meeting-id")
            if not meeting_id:
                logger.info(
                    "warm_pool.reaper.no_meeting_id_label",
                    pod_name=pod_name,
                )
                return

            from src.api.database.connection import (  # noqa: WPS433
                get_db_connection,
            )
            from src.services.meeting_service import MeetingService  # noqa: WPS433
            from src.services.rejoin_orchestrator import (  # noqa: WPS433
                RejoinOrchestrator,
            )

            db = await get_db_connection()
            meeting_service = MeetingService(db)
            # For cleanly-ended pods (exit_reason=None) use the reason the bot
            # recorded on the meeting row so the orchestrator classifies it
            # correctly (completed/failed vs rejoin). Fall back to a clean-exit
            # terminal reason if the bot didn't record one.
            if exit_reason is None:
                try:
                    meeting = await meeting_service.get_meeting_by_id(meeting_id)
                    exit_reason = (
                        getattr(meeting, "exit_reason", None) or "exited_clean"
                    )
                except Exception:  # noqa: BLE001
                    exit_reason = "exited_clean"
            orchestrator = RejoinOrchestrator(meeting_service=meeting_service)
            result = await orchestrator.attempt(
                meeting_id=meeting_id,
                exit_reason=exit_reason,
                dropped_pod_name=pod_name,
            )
            logger.info(
                "warm_pool.reaper.rejoin_triggered",
                pod_name=pod_name,
                meeting_id=meeting_id,
                exit_reason=exit_reason,
                rejoin_success=result.success,
                new_pod_name=result.new_pod_name,
            )
        except Exception as e:  # noqa: BLE001
            logger.warning(
                "warm_pool.reaper.rejoin_trigger_failed",
                pod_name=pod_name,
                exit_reason=exit_reason,
                error=str(e),
            )

    async def _classify_pod_for_reap(self, pod_name: str, pod_ip: str) -> Optional[str]:
        """Return a reap reason (``"ended"`` / ``"stuck"``) or ``None``."""
        health = await self._fetch_sidecar_health(pod_name, pod_ip)
        if health is None:
            return None

        meeting_state = health.get("meeting_state")
        now = datetime.now(timezone.utc)

        if meeting_state == "stuck":
            return "stuck"

        last_heartbeat = _parse_iso_timestamp(health.get("last_heartbeat_ts"))
        if last_heartbeat is not None:
            elapsed = (now - last_heartbeat).total_seconds()
            if elapsed > STUCK_HEARTBEAT_SECONDS:
                return "stuck"

        if meeting_state == "ended":
            last_segment = _parse_iso_timestamp(health.get("last_segment_ts"))
            # When the bot subprocess is DEAD, the heartbeat must not delay the
            # reap. Pre-fix sidecars fabricate last_heartbeat_ts="now" on every
            # poll, so this grace never elapsed → ended pods were never reaped
            # and their meetings never completed (observed live). And even with
            # a truthful heartbeat, a dead bot has nothing left to flush unless
            # segments are still settling — so dead bot → only last_segment_ts
            # counts as a wait-reference; with neither, reap now (the reaper
            # double-checks 5s apart before acting).
            bot_alive = health.get("bot_subprocess_alive", True)
            reference = (
                last_segment
                if last_segment is not None
                else (last_heartbeat if bot_alive else None)
            )
            if reference is None:
                return "ended"
            elapsed = (now - reference).total_seconds()
            if elapsed > ENDED_GRACE_SECONDS:
                return "ended"

        return None

    async def _fetch_sidecar_health(self, pod_name: str, pod_ip: str) -> Optional[dict]:
        """Query sidecar ``/health`` endpoint; return parsed JSON or ``None``."""
        try:
            async with httpx.AsyncClient(timeout=REAPER_HEALTH_TIMEOUT) as http:
                response = await http.get(_sidecar_url(pod_name, pod_ip, "/health"))
                if response.status_code == 200:
                    return response.json()
        except Exception:
            return None
        return None

    # =========================================================================
    # Status
    # =========================================================================

    async def get_status(self) -> dict:
        """Return warm pool status derived from K8s labels."""
        warm_count, total_active, by_state = await self._get_pool_counts()
        return {
            "target_size": WARM_POOL_SIZE,
            "max_size": WARM_POOL_MAX,
            "warm_count": warm_count,
            "total_pods": total_active,
            "by_state": by_state,
            "ended_grace_seconds": ENDED_GRACE_SECONDS,
            "stuck_heartbeat_seconds": STUCK_HEARTBEAT_SECONDS,
            "backstop_deadline_seconds": ACTIVE_DEADLINE_SECONDS,
        }


# =============================================================================
# Singleton factory
# =============================================================================

_warm_pool: Optional[WarmPoolManager] = None
_warm_pool_lock: Optional[asyncio.Lock] = None


def _get_warm_pool_lock() -> asyncio.Lock:
    """Lazy-create the warm-pool lock in the active event loop."""
    global _warm_pool_lock
    if _warm_pool_lock is None:
        _warm_pool_lock = asyncio.Lock()
    return _warm_pool_lock


async def get_warm_pool() -> Optional[WarmPoolManager]:
    """Get or create a process-local warm pool manager.

    Returns ``None`` in compose / local-dev mode where K8s is unavailable.
    """
    global _warm_pool
    # "standalone" (canonical) and "compose" (legacy alias) both mean
    # no-Kubernetes local dev: the warm pool requires a cluster, so skip it.
    if os.environ.get("RUNTIME_MODE", "").lower() in ("compose", "standalone"):
        logger.info("warm_pool.skipped_in_standalone_mode")
        return None

    lock = _get_warm_pool_lock()
    async with lock:
        if _warm_pool is None:
            _warm_pool = WarmPoolManager()
        await _warm_pool.start()
        return _warm_pool


async def close_warm_pool() -> None:
    """Close and reset the process-local warm pool singleton."""
    global _warm_pool
    warm_pool = _warm_pool
    _warm_pool = None
    if warm_pool is not None:
        await warm_pool.stop()
