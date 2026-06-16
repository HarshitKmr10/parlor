"""Ghost-pod reaper — detects meetings whose pod disappeared from k8s.

The warm-pool reaper at :mod:`src.services.warm_pool_manager` only iterates
pods that currently exist. When a pod is force-evicted (node failure,
disk pressure eviction, OOM-killed by the kernel before the soft monitor
trips, manual `kubectl delete --force`), the row in ``meeting_joiner``
still references a ``pod_name`` that no longer exists. Without a
detector, that meeting sits in ``ongoing``/``joining`` until the safety-
net cleanup service marks it complete on a much slower cadence.

This reaper closes the gap:

1. Every ``GHOST_REAPER_INTERVAL_S`` (default 30 s), query
   ``meeting_joiner`` for rows in active states with a ``pod_name`` set.
2. For each, ask k8s if the pod still exists.
3. If the pod is gone, fire :class:`RejoinOrchestrator` with
   ``exit_reason="pod_evicted"``. The orchestrator decides whether to
   rejoin (within window, under session cap) or move the meeting to
   ``failed``.

Safe to run alongside the warm-pool reaper — both end up calling the
same orchestrator, which is idempotent on already-closed sessions.
"""

from __future__ import annotations

import asyncio
import os
from datetime import datetime, timezone
from typing import Iterable, Optional

from kubernetes_asyncio import client
from kubernetes_asyncio.client.exceptions import ApiException

from src.api.database.connection import get_db_connection
from src.api.models.schemas import MeetingStatus
from src.db.python.schema import qualified_name
from src.observability import get_logger
from src.services.k8s_auth import build_authenticated_api_client
from src.services.meeting_service import MeetingService
from src.services.rejoin_orchestrator import RejoinOrchestrator

logger = get_logger(__name__)

GHOST_REAPER_INTERVAL_S = int(os.environ.get("GHOST_REAPER_INTERVAL_S", "30"))


def _meeting_namespace_from_env() -> str:
    """Return the namespace used for managed worker pods.

    ``MEETING_JOINER_NAMESPACE`` is kept for backward compatibility with the
    original ghost reaper. ``MEETING_NAMESPACE`` matches warm_pool_manager and
    is the chart-facing managed-pod contract.
    """
    return (
        (os.environ.get("MEETING_JOINER_NAMESPACE") or "").strip()
        or (os.environ.get("MEETING_NAMESPACE") or "").strip()
        or "default"
    )


MEETING_NAMESPACE = _meeting_namespace_from_env()
# A bot heartbeats (meeting_joiner.last_heartbeat_at) every status-loop tick
# (~5s). If a heartbeat exists but has gone older than this, the bot is dead
# even though the pod object may still report phase=Running (e.g. the sidecar
# container was OOMKilled while bot-runtime kept the pod alive) — recover it.
STUCK_HEARTBEAT_SECONDS = int(os.environ.get("STUCK_HEARTBEAT_SECONDS", "90"))
ACTIVE_STATUSES: tuple[str, ...] = (
    MeetingStatus.JOINING.value,
    MeetingStatus.ONGOING.value,
    MeetingStatus.INTERRUPTED.value,
)


class GhostPodReaper:
    """Background loop that detects vanished pods and re-dispatches their meetings.

    The reaper is intentionally narrow: it ONLY notices "I expected a pod
    here and it isn't there." It does not duplicate the warm-pool
    reaper's stuck/ended detection.
    """

    def __init__(self) -> None:
        self._task: Optional[asyncio.Task[None]] = None
        self._running = False
        self._k8s_api: Optional[client.CoreV1Api] = None
        self._k8s_client: Optional[client.ApiClient] = None

    @staticmethod
    def _table_name(db, name: str) -> str:
        if getattr(db, "_driver", None) == "pg":
            return qualified_name(name)
        return name

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._loop())
        logger.info(
            "ghost_pod_reaper.started",
            interval_s=GHOST_REAPER_INTERVAL_S,
            namespace=MEETING_NAMESPACE,
        )

    async def stop(self) -> None:
        self._running = False
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        if self._k8s_client is not None:
            try:
                await self._k8s_client.close()
            except Exception:  # noqa: BLE001
                pass
            self._k8s_client = None
            self._k8s_api = None
        logger.info("ghost_pod_reaper.stopped")

    async def _loop(self) -> None:
        while self._running:
            try:
                await self._scan_once()
            except asyncio.CancelledError:
                break
            except Exception as e:  # noqa: BLE001
                logger.error("ghost_pod_reaper.loop_error", error=str(e))
            await asyncio.sleep(GHOST_REAPER_INTERVAL_S)

    async def _scan_once(self) -> None:
        """One pass: find ghost meetings and trigger rejoin for each."""
        candidates = await self._candidate_meetings()
        if not candidates:
            return

        api = await self._get_k8s_api()
        if api is None:
            logger.warning("ghost_pod_reaper.k8s_unavailable")
            return

        for meeting_id, pod_name, last_hb in candidates:
            try:
                if not await self._pod_still_exists(api, pod_name):
                    await self._fire_rejoin(meeting_id, pod_name)
                    continue
                # Pod object exists, but the bot can still be dead — e.g. the
                # sidecar container OOMKilled while bot-runtime kept the pod
                # phase=Running. Detect via a heartbeat that has gone stale.
                # Only act when a heartbeat EXISTS and is stale: a None
                # heartbeat is normal during the join window and is left to
                # the pod-existence / activeDeadline paths (avoids killing a
                # healthy meeting that hasn't started heartbeating yet).
                if last_hb is not None:
                    age = (datetime.now(timezone.utc) - last_hb).total_seconds()
                    if age > STUCK_HEARTBEAT_SECONDS:
                        logger.warning(
                            "ghost_pod_reaper.stale_heartbeat",
                            meeting_id=meeting_id,
                            pod_name=pod_name,
                            heartbeat_age_s=round(age),
                        )
                        await self._fire_rejoin(meeting_id, pod_name)
            except Exception as e:  # noqa: BLE001
                logger.warning(
                    "ghost_pod_reaper.check_failed",
                    meeting_id=meeting_id,
                    pod_name=pod_name,
                    error=str(e),
                )

    async def _candidate_meetings(
        self,
    ) -> list[tuple[str, str, Optional[datetime]]]:
        """Return ``[(meeting_id, pod_name, last_heartbeat_at), ...]``.

        Only rows in active statuses with a pod assigned are interesting.
        ``last_heartbeat_at`` lets the caller catch a dead bot in a still-
        present pod. Limit to a small batch per cycle so a misconfigured
        cluster doesn't make one reaper run last minutes.
        """
        try:
            db = await get_db_connection()
            if not db._connected:
                await db.connect()
            meeting_table = self._table_name(db, "meeting_joiner")
            rows = await db.execute_query(
                f"""
                SELECT id, pod_name, last_heartbeat_at
                FROM {meeting_table}
                WHERE status::text = ANY($1::text[])
                  AND pod_name IS NOT NULL
                ORDER BY updated_at DESC
                LIMIT 100
                """,
                list(ACTIVE_STATUSES),
            )
        except Exception as e:  # noqa: BLE001
            logger.warning("ghost_pod_reaper.candidate_query_failed", error=str(e))
            return []
        return [
            (str(row["id"]), row["pod_name"], row["last_heartbeat_at"])
            for row in rows or []
        ]

    async def _pod_still_exists(self, api: client.CoreV1Api, pod_name: str) -> bool:
        """Return True if k8s still knows about this pod (Pending/Running)."""
        try:
            pod = await api.read_namespaced_pod(
                name=pod_name, namespace=MEETING_NAMESPACE
            )
        except ApiException as e:
            if e.status == 404:
                return False
            raise
        phase = pod.status.phase if pod and pod.status else None
        # A pod in Failed/Succeeded is technically still "known" but it has
        # exited — treat it as gone so the orchestrator can resume on a
        # fresh pod. Sidecar would have made the callback for clean exits;
        # this path covers the messy ones (e.g. kernel OOM-killed the
        # whole pod before the sidecar could call back).
        return phase in {"Pending", "Running"}

    async def _fire_rejoin(self, meeting_id: str, pod_name: str) -> None:
        """Run the rejoin orchestrator with a synthesised pod_evicted exit."""
        db = await get_db_connection()
        orchestrator = RejoinOrchestrator(meeting_service=MeetingService(db))
        result = await orchestrator.attempt(
            meeting_id=meeting_id,
            exit_reason="pod_evicted",
            dropped_pod_name=pod_name,
        )
        logger.info(
            "ghost_pod_reaper.rejoin_triggered",
            meeting_id=meeting_id,
            pod_name=pod_name,
            rejoin_success=result.success,
            new_pod_name=result.new_pod_name,
            error=result.error,
        )

    async def _get_k8s_api(self) -> Optional[client.CoreV1Api]:
        if self._k8s_api is not None:
            return self._k8s_api
        try:
            from kubernetes_asyncio import config as k8s_config

            try:
                k8s_config.load_incluster_config()
            except k8s_config.config_exception.ConfigException:
                try:
                    await k8s_config.load_kube_config()
                except Exception as e:  # noqa: BLE001
                    logger.warning(
                        "ghost_pod_reaper.k8s_config_failed",
                        error=str(e),
                    )
                    return None
            self._k8s_client = build_authenticated_api_client()
            self._k8s_api = client.CoreV1Api(self._k8s_client)
            return self._k8s_api
        except Exception as e:  # noqa: BLE001
            logger.warning("ghost_pod_reaper.k8s_init_failed", error=str(e))
            return None

    def get_status(self) -> dict:
        return {
            "running": self._running,
            "interval_s": GHOST_REAPER_INTERVAL_S,
            "namespace": MEETING_NAMESPACE,
            "active_statuses": list(ACTIVE_STATUSES),
        }


_singleton: Optional[GhostPodReaper] = None


def get_ghost_pod_reaper() -> GhostPodReaper:
    global _singleton
    if _singleton is None:
        _singleton = GhostPodReaper()
    return _singleton


async def close_ghost_pod_reaper() -> None:
    global _singleton
    if _singleton is not None:
        await _singleton.stop()
        _singleton = None
