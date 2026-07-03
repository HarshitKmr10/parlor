"""Local subprocess bot dispatch for RUNTIME_MODE=standalone.

In K8s the warm pool claims a pod and the sidecar's :class:`BotSupervisor`
spawns the bot subprocess inside it. Standalone dev has no cluster, so this
module mirrors that supervisor: it forks the bot as a *local* subprocess on the
API host, tracks the process + heartbeats, and drives the meeting through the
contract status machine ``scheduled → joining → ongoing → completed/failed``.

Degradation contract (must never crash the API):

* ``MEETING_BOT_MODE=disabled`` → don't spawn; mark the meeting ``failed`` with
  ``exit_reason=bot_runtime_unavailable`` and log what *would* have run.
* Bot entrypoint / Chromium / node missing → same terminal ``failed`` with a
  clear ``exit_reason``, logging the resolved argv for the operator.
* Clean exit (returncode 0) → ``completed``.
* Non-zero exit → ``failed`` with ``exit_reason=bot_exited_code_<n>``. If the
  drop looks recoverable AND a rejoin path is available, the existing rejoin
  orchestrator is given a chance first.

Each runner owns exactly one subprocess. Multiple concurrent meetings get
multiple runners, tracked in a process-wide registry so shutdown can reap them.
"""

from __future__ import annotations

import asyncio
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

from shared.config import settings

from ..api.database.connection import get_db_connection
from ..api.models.schemas import MeetingStatus
from ..observability import get_logger
from .meeting_service import MeetingService
from .zoom_sdk_service import ZoomSDKService

logger = get_logger(__name__)

UTC = timezone.utc

# Mirror the sidecar's entrypoint resolution so a standalone box can reuse the
# same bot tree if it's present. Env-overridable for local layouts.
NODE_BOT_ENTRYPOINT = Path(
    os.environ.get(
        "NODE_BOT_ENTRYPOINT",
        "/app/meeting-joiner/src/bot/bot_scripts/sidecar_launcher.js",
    )
)
ZOOM_BOT_MODULE = "src.bot.zoom_sdk_bot.zoom_bot_runner"

# Exit reasons surfaced on the meeting row (queryable like the production ones).
EXIT_RUNTIME_UNAVAILABLE = "bot_runtime_unavailable"
EXIT_CLEAN = "bot_exited_clean"
EXIT_SPAWN_FAILED = "bot_spawn_failed"


def _argv_for_platform(platform: str) -> List[str]:
    """Resolve the executable + args for a platform (pure, testable)."""
    if platform in ("msteams", "googlemeet"):
        return ["node", str(NODE_BOT_ENTRYPOINT), platform]
    if platform == "zoom":
        return ["python", "-m", ZOOM_BOT_MODULE]
    raise ValueError(f"unsupported platform: {platform}")


def _runtime_check(platform: str) -> Optional[str]:
    """Return an ``exit_reason`` if the local runtime can't run the bot.

    ``None`` means the runtime looks usable. We only check for the presence of
    the launcher interpreter and the bot entrypoint — we do not try to launch
    Chromium here, but a missing node/python interpreter or a missing bot tree
    is a deterministic "can't even start" that we surface up front instead of
    spawning a process that immediately dies.
    """
    if settings.MEETING_BOT_MODE.lower() == "disabled":
        return EXIT_RUNTIME_UNAVAILABLE

    if platform in ("msteams", "googlemeet"):
        if shutil.which("node") is None:
            return "bot_runtime_unavailable_no_node"
        if not NODE_BOT_ENTRYPOINT.exists():
            return "bot_runtime_unavailable_no_entrypoint"
        # Chromium is what the Playwright bot actually drives. If neither a
        # bundled nor a system Chromium is discoverable, the bot cannot join.
        if not _chromium_present():
            return "bot_runtime_unavailable_no_chromium"
    elif platform == "zoom":
        if shutil.which("python") is None and shutil.which("python3") is None:
            return "bot_runtime_unavailable_no_python"
    return None


def _chromium_present() -> bool:
    """Best-effort detection of a usable Chromium/Chrome binary."""
    candidates = [
        os.environ.get("CHROMIUM_PATH"),
        os.environ.get("PLAYWRIGHT_CHROMIUM_PATH"),
        "chromium",
        "chromium-browser",
        "google-chrome",
        "google-chrome-stable",
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
        "/usr/bin/google-chrome",
    ]
    for c in candidates:
        if not c:
            continue
        if os.path.isabs(c):
            if os.path.exists(c):
                return True
        elif shutil.which(c):
            return True
    # Playwright's default browser cache.
    cache = Path.home() / ".cache" / "ms-playwright"
    if cache.exists() and any(cache.glob("chromium-*/chrome-linux/chrome")):
        return True
    if cache.exists() and any(cache.glob("chromium-*/chrome-mac/**/Chromium")):
        return True
    return False


class LocalBotRunner:
    """Owns one local bot subprocess for one meeting (standalone mode)."""

    def __init__(
        self,
        *,
        meeting_id: str,
        meeting_url: str,
        platform: str,
        bot_name: Optional[str],
        transcript_source: Optional[str],
        org_id: Optional[str],
        notetaker_email: Optional[str] = None,
    ) -> None:
        self.meeting_id = meeting_id
        self.meeting_url = meeting_url
        self.platform = platform
        self.bot_name = bot_name or settings.BOT_NAME
        self.transcript_source = transcript_source
        self.org_id = org_id or ""
        # The Workspace account the bot joins meetings AS (auto-admission to
        # internal Meet meetings). Per-workspace; falls back to the env default.
        self.notetaker_email = notetaker_email or settings.MEET_NOTETAKER_EMAIL
        self._proc: Optional[asyncio.subprocess.Process] = None
        self._monitor_task: Optional[asyncio.Task[None]] = None

    # ── public API ────────────────────────────────────────────────────────
    async def start(self) -> bool:
        """Transition the meeting to ``joining`` and spawn the bot.

        Returns ``True`` if a subprocess was spawned, ``False`` if the runtime
        was unavailable (meeting already marked ``failed``). Never raises for
        an unavailable runtime — that's a degraded-but-clean outcome.
        """
        svc = await self._service()

        # Block unavailable runtime *before* claiming the joining state so the
        # status reflects reality (failed, not stuck joining).
        unavailable_reason = _runtime_check(self.platform)
        if unavailable_reason is not None:
            argv = self._safe_argv()
            logger.warning(
                "local_bot_runner.runtime_unavailable",
                meeting_id=self.meeting_id,
                platform=self.platform,
                reason=unavailable_reason,
                would_have_run=argv,
            )
            await self._mark_failed(svc, EXIT_RUNTIME_UNAVAILABLE, {
                "detail": unavailable_reason,
                "would_have_run": argv,
            })
            return False

        await self._transition(svc, MeetingStatus.JOINING)

        try:
            argv = _argv_for_platform(self.platform)
            env = self._build_env()
            logger.info(
                "local_bot_runner.spawn",
                meeting_id=self.meeting_id,
                platform=self.platform,
                argv=argv,
            )
            self._proc = await asyncio.create_subprocess_exec(
                *argv,
                env=env,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
        except (FileNotFoundError, OSError, ValueError) as exc:
            logger.warning(
                "local_bot_runner.spawn_failed",
                meeting_id=self.meeting_id,
                error=str(exc),
            )
            await self._mark_failed(
                svc, EXIT_SPAWN_FAILED, {"detail": str(exc)}
            )
            return False

        _REGISTRY.add(self)
        self._monitor_task = asyncio.create_task(
            self._monitor(), name=f"local-bot-monitor-{self.meeting_id}"
        )
        return True

    async def stop(self, *, grace_seconds: int = 10) -> None:
        """Terminate the subprocess (SIGTERM then SIGKILL) without rejoin."""
        if self._proc is None or self._proc.returncode is not None:
            return
        try:
            self._proc.terminate()
        except ProcessLookupError:
            return
        try:
            await asyncio.wait_for(self._proc.wait(), timeout=grace_seconds)
        except asyncio.TimeoutError:
            try:
                self._proc.kill()
            except ProcessLookupError:
                pass
            await self._proc.wait()

    def is_alive(self) -> bool:
        return self._proc is not None and self._proc.returncode is None

    # ── internals ─────────────────────────────────────────────────────────
    async def _service(self) -> MeetingService:
        db = await get_db_connection()
        return MeetingService(db)

    def _safe_argv(self) -> List[str]:
        try:
            return _argv_for_platform(self.platform)
        except ValueError:
            return [f"<unsupported platform {self.platform}>"]

    def _build_env(self) -> Dict[str, str]:
        env = os.environ.copy()
        env["MEETING_ID"] = self.meeting_id
        env["MEETING_URL"] = self.meeting_url
        env["ORG_ID"] = self.org_id
        env["PLATFORM"] = self.platform
        env["BOT_NAME"] = self.bot_name
        env["SESSION_NUMBER"] = "1"
        if self.platform == "zoom":
            # MEETING_ID above is the meeting_joiner DB row id, not the
            # numeric Zoom meeting number the bot needs to join — parse the
            # real number + password out of the URL (mirrors BotSupervisor's
            # _build_env) so zoom_bot_runner.py's __main__ gets a joinable
            # meeting instead of falling back to unset env vars.
            zoom_info = ZoomSDKService.parse_zoom_url(self.meeting_url)
            if zoom_info is not None:
                env["ZOOM_MEETING_NUMBER"] = zoom_info["meeting_id"]
                env["ZOOM_MEETING_PWD"] = zoom_info["password"]
        if self.transcript_source:
            env["TRANSCRIPT_SOURCE"] = self.transcript_source
        if self.notetaker_email:
            # The bot reads this to sign in / present the notetaker identity so
            # internal Meet meetings auto-admit it.
            env["MEET_NOTETAKER_EMAIL"] = self.notetaker_email
        return env

    async def _monitor(self) -> None:
        """Pump bot output and drive the terminal transition on exit."""
        assert self._proc is not None
        stdout_task = asyncio.create_task(self._pump(self._proc.stdout, "stdout"))
        stderr_task = asyncio.create_task(self._pump(self._proc.stderr, "stderr"))
        try:
            returncode = await self._proc.wait()
        except asyncio.CancelledError:
            raise
        finally:
            for t in (stdout_task, stderr_task):
                t.cancel()

        logger.info(
            "local_bot_runner.exit",
            meeting_id=self.meeting_id,
            returncode=returncode,
        )
        _REGISTRY.discard(self)

        svc = await self._service()
        if returncode == 0:
            await self._mark_completed(svc)
            return

        exit_reason = f"bot_exited_code_{returncode}"
        # Give the recovery path a chance for a recoverable, non-zero exit.
        if await self._try_rejoin(exit_reason):
            return
        await self._mark_failed(svc, exit_reason, {"returncode": returncode})

    async def _pump(self, stream, name: str) -> None:
        if stream is None:
            return
        try:
            while True:
                line = await stream.readline()
                if not line:
                    return
                logger.info(
                    "local_bot_runner.output",
                    meeting_id=self.meeting_id,
                    stream=name,
                    line=line.decode("utf-8", errors="replace").rstrip(),
                )
        except asyncio.CancelledError:
            return
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "local_bot_runner.pump_error", meeting_id=self.meeting_id, error=str(exc)
            )

    async def _try_rejoin(self, exit_reason: str) -> bool:
        """Run the existing rejoin orchestrator if the drop is recoverable.

        The orchestrator's warm-pool rejoin needs K8s, so in pure standalone
        this typically declines (returns rejoined=False), and we fall through
        to ``failed``. Wrapped so any orchestrator error degrades cleanly.
        """
        try:
            from .rejoin_orchestrator import RejoinOrchestrator

            svc = await self._service()
            orchestrator = RejoinOrchestrator(meeting_service=svc)
            result = await orchestrator.attempt(
                meeting_id=self.meeting_id,
                exit_reason=exit_reason,
                dropped_pod_name=None,
            )
            rejoined = bool(getattr(result, "rejoined", False))
            if rejoined:
                logger.info(
                    "local_bot_runner.rejoin_initiated", meeting_id=self.meeting_id
                )
            return rejoined
        except Exception as exc:  # noqa: BLE001
            logger.info(
                "local_bot_runner.rejoin_skipped",
                meeting_id=self.meeting_id,
                error=str(exc),
            )
            return False

    async def _transition(self, svc: MeetingService, status: MeetingStatus) -> None:
        try:
            await svc.update_meeting_status(self.meeting_id, status)
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "local_bot_runner.transition_failed",
                meeting_id=self.meeting_id,
                status=status.value,
                error=str(exc),
            )

    async def _mark_completed(self, svc: MeetingService) -> None:
        try:
            await svc.update_meeting_status(
                self.meeting_id,
                MeetingStatus.COMPLETED,
                exit_reason=EXIT_CLEAN,
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "local_bot_runner.mark_completed_failed",
                meeting_id=self.meeting_id,
                error=str(exc),
            )
        await _fire_completion_pipeline(self.meeting_id)

    async def _mark_failed(
        self, svc: MeetingService, exit_reason: str, details: dict
    ) -> None:
        try:
            await svc.update_meeting_status(
                self.meeting_id,
                MeetingStatus.FAILED,
                exit_reason=exit_reason,
                exit_details=details,
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "local_bot_runner.mark_failed_error",
                meeting_id=self.meeting_id,
                error=str(exc),
            )


# ── process-wide registry (for graceful shutdown) ─────────────────────────
_REGISTRY: "set[LocalBotRunner]" = set()


async def shutdown_local_bot_runners() -> None:
    """Terminate any tracked local bot subprocesses on app shutdown."""
    runners = list(_REGISTRY)
    for r in runners:
        try:
            await r.stop(grace_seconds=3)
        except Exception as exc:  # noqa: BLE001
            logger.warning("local_bot_runner.shutdown_error", error=str(exc))
    _REGISTRY.clear()


async def dispatch_local_bot(
    *,
    meeting_id: str,
    meeting_url: str,
    platform: str,
    transcript_source: Optional[str],
    bot_name: Optional[str],
    org_id: Optional[str],
    notetaker_email: Optional[str] = None,
) -> bool:
    """Standalone dispatch entrypoint — spawn a local bot for the meeting.

    Returns ``True`` if a subprocess was spawned, ``False`` if the meeting was
    marked ``failed`` due to an unavailable runtime / spawn failure. Mirrors the
    ``(dispatched, ...)`` semantics of the warm-pool path so callers can treat
    both uniformly.
    """
    runner = LocalBotRunner(
        meeting_id=meeting_id,
        meeting_url=meeting_url,
        platform=platform,
        bot_name=bot_name,
        transcript_source=transcript_source,
        org_id=org_id,
        notetaker_email=notetaker_email,
    )
    return await runner.start()


async def _fire_completion_pipeline(meeting_id: str) -> None:
    """Kick the embed→summarize→recap pipeline; tolerate it being absent."""
    try:
        from .completion_pipeline import run_completion_pipeline

        asyncio.create_task(
            run_completion_pipeline(meeting_id),
            name=f"completion-pipeline-{meeting_id}",
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "local_bot_runner.completion_pipeline_skipped",
            meeting_id=meeting_id,
            error=str(exc),
        )
