"""Bot subprocess lifecycle: spawn, monitor, terminate.

Each meeting-worker pod runs one bot subprocess at a time. The supervisor:

* Picks the right argv/env for the requested platform (msteams, googlemeet,
  zoom) — all config is passed via env vars so the bot Dockerfiles never
  need to know about the sidecar's wire format.
* Forks the process via ``asyncio.create_subprocess_exec`` so the event loop
  stays responsive.
* Pumps stdout/stderr through structlog so bot logs end up in the same
  Loki stream as the sidecar's.
* On exit, updates ``SidecarStateManager`` so ``/health`` flips to ``ended``.
* Supports graceful SIGTERM with a SIGKILL fallback after ``grace_seconds``.
"""

from __future__ import annotations

import asyncio
import os
import signal
from pathlib import Path
from typing import List, Optional, Tuple

import psutil

from src.services.zoom_sdk_service import ZoomSDKService

from .models import ConfigureRequest
from .state import SidecarStateManager

# Bot script locations inside the container. These are deliberately absolute
# so the sidecar doesn't depend on its cwd at spawn time.
# RCA #29: hardcoded path didn't match where the worker image installs the
# bot tree. Now env-overridable with a corrected default.
NODE_BOT_ENTRYPOINT = Path(os.environ.get(
    "NODE_BOT_ENTRYPOINT",
    "/app/meeting-joiner/src/bot/bot_scripts/sidecar_launcher.js",
))
ZOOM_BOT_MODULE = "src.bot.zoom_sdk_bot.zoom_bot_runner"

# Touch this file to signal the bot to flush its transcript and exit. The bot
# is expected to poll for it; SIGTERM alone is not always enough to let the
# Playwright page finish a clean shutdown.
ABORT_SIGNAL_PATH = Path(os.environ.get("BOT_ABORT_SIGNAL_PATH", "/tmp/bot-abort.signal"))


def _build_env(config: ConfigureRequest) -> dict[str, str]:
    """Construct env vars for the bot subprocess.

    All keys are strings (subprocess env requirement). ``None`` fields are
    simply omitted so the bot can use its own defaults. ``HttpUrl`` values
    are stringified for transport.
    """
    env = os.environ.copy()
    env["MEETING_ID"] = config.meeting_id
    env["MEETING_URL"] = str(config.meeting_url)
    env["ORG_ID"] = config.org_id
    env["PLATFORM"] = config.platform
    env["BOT_NAME"] = config.bot_name
    env["SESSION_NUMBER"] = str(config.session_number)
    if config.platform == "zoom":
        # MEETING_ID above is the meeting_joiner DB row id, not the numeric
        # Zoom meeting number the bot needs to join — parse the real number
        # + password out of the URL and pass them via dedicated env vars so
        # zoom_bot_runner.py's __main__ (which reads ZOOM_MEETING_NUMBER /
        # ZOOM_MEETING_PWD) actually gets a joinable meeting.
        zoom_info = ZoomSDKService.parse_zoom_url(str(config.meeting_url))
        if zoom_info is not None:
            env["ZOOM_MEETING_NUMBER"] = zoom_info["meeting_id"]
            env["ZOOM_MEETING_PWD"] = zoom_info["password"]
    if config.bot_avatar_url is not None:
        env["BOT_AVATAR_URL"] = str(config.bot_avatar_url)
    if config.transcript_source is not None:
        env["TRANSCRIPT_SOURCE"] = config.transcript_source
    if config.webhook_url is not None:
        env["WEBHOOK_URL"] = str(config.webhook_url)
    if config.max_duration_seconds is not None:
        env["MAX_DURATION_SECONDS"] = str(config.max_duration_seconds)
    # Signed-in Google Meet support (K8s parity with LocalBotRunner._build_env).
    # MEET_NOTETAKER_EMAIL selects the pooled storageState; the sidecar_launcher
    # resolves <GOOGLE_AUTH_STATE_DIR>/<email>.json (or honors an explicit path).
    if config.notetaker_email is not None:
        env["MEET_NOTETAKER_EMAIL"] = config.notetaker_email
    if config.google_auth_state_path is not None:
        env["GOOGLE_AUTH_STATE_PATH"] = config.google_auth_state_path
    return env


def _argv_for_platform(platform: str) -> List[str]:
    """Resolve the executable + args for a platform.

    Kept as a pure function so it's trivial to unit-test the matrix in a
    follow-up PR without spawning anything.
    """
    if platform in ("msteams", "googlemeet"):
        return ["node", str(NODE_BOT_ENTRYPOINT), platform]
    if platform == "zoom":
        return ["python", "-m", ZOOM_BOT_MODULE]
    raise ValueError(f"unsupported platform: {platform}")


class BotSupervisor:
    """Owns the lifecycle of the bot subprocess for one pod."""

    def __init__(self, state_manager: SidecarStateManager) -> None:
        self._state = state_manager
        self._proc: Optional[asyncio.subprocess.Process] = None
        self._monitor_task: Optional[asyncio.Task[None]] = None
        self._log_pump_tasks: List[asyncio.Task[None]] = []
        # Guards the full check-spawn-mark_configuring sequence in the
        # /configure route handler so two concurrent requests can't both
        # pass the busy-check and race into spawn() (TOCTOU double-spawn).
        # The route holds this for the whole sequence; spawn() itself no
        # longer needs its own internal races checked separately.
        self.configure_lock: asyncio.Lock = asyncio.Lock()
        # Lazy import to avoid circular dependency with main.py.
        from src.observability import get_logger

        self._logger = get_logger("sidecar.bot_supervisor")

    async def spawn(self, config: ConfigureRequest) -> int:
        """Fork the bot subprocess and return its PID.

        Raises ``RuntimeError`` if a bot is already running in this pod —
        the route handler should have rejected the request before getting
        here, but we double-check to avoid orphaning a previous process.
        """
        if self._proc is not None and self._proc.returncode is None:
            raise RuntimeError("bot subprocess already running")

        # Wipe stale signal files from any previous run in this pod.
        try:
            ABORT_SIGNAL_PATH.unlink(missing_ok=True)
        except OSError:
            # Non-fatal: bot will simply ignore a stale file on first poll.
            pass

        argv = _argv_for_platform(config.platform)
        env = _build_env(config)

        self._logger.info(
            "sidecar.bot.spawn",
            platform=config.platform,
            meeting_id=config.meeting_id,
            session_number=config.session_number,
            argv=argv,
        )

        self._proc = await asyncio.create_subprocess_exec(
            *argv,
            env=env,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        pid = self._proc.pid

        # Pump stdout / stderr lines through structlog so bot output ends up
        # in the same Loki stream as the sidecar's.
        assert self._proc.stdout is not None and self._proc.stderr is not None
        self._log_pump_tasks = [
            asyncio.create_task(
                self._pump_stream(self._proc.stdout, "stdout"),
                name="bot-stdout-pump",
            ),
            asyncio.create_task(
                self._pump_stream(self._proc.stderr, "stderr"),
                name="bot-stderr-pump",
            ),
        ]
        self._monitor_task = asyncio.create_task(
            self._monitor(), name="bot-supervisor-monitor"
        )
        return pid

    async def _pump_stream(
        self, stream: asyncio.StreamReader, name: str
    ) -> None:
        """Forward every line from the subprocess pipe into structlog."""
        try:
            while True:
                line = await stream.readline()
                if not line:
                    return
                self._logger.info(
                    "sidecar.bot.output",
                    stream=name,
                    line=line.decode("utf-8", errors="replace").rstrip(),
                )
        except asyncio.CancelledError:
            # Expected during shutdown; let it propagate.
            raise
        except Exception as exc:
            # Never let a log-pump crash take down the supervisor; just
            # record and stop.
            self._logger.warning(
                "sidecar.bot.output.pump_error",
                stream=name,
                error=str(exc),
            )

    async def _monitor(self) -> None:
        """Await subprocess exit and flip the shared state to ENDED."""
        assert self._proc is not None
        try:
            returncode = await self._proc.wait()
        except asyncio.CancelledError:
            raise
        exit_reason = "exited_clean" if returncode == 0 else f"exited_code_{returncode}"
        await self._state.mark_ended(
            returncode=returncode, exit_reason=exit_reason
        )
        self._logger.info(
            "sidecar.bot.exit",
            pid=self._proc.pid,
            returncode=returncode,
            exit_reason=exit_reason,
        )

    def is_alive(self) -> bool:
        """True iff the bot subprocess exists and hasn't exited yet."""
        if self._proc is None:
            return False
        return self._proc.returncode is None

    def get_rss_mb(self) -> Optional[int]:
        """Resident set size in MiB via psutil. ``None`` if no bot or it died.

        ``psutil`` may race with the process exit and raise
        ``NoSuchProcess`` — we swallow it and return ``None`` rather than
        propagating, because ``/health`` should never 500 over a dying bot.
        """
        if self._proc is None or self._proc.returncode is not None:
            return None
        try:
            proc = psutil.Process(self._proc.pid)
            rss_bytes = proc.memory_info().rss
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            return None
        return int(rss_bytes / (1024 * 1024))

    def get_pid(self) -> Optional[int]:
        """Current PID, or ``None`` if no bot subprocess is tracked."""
        return self._proc.pid if self._proc is not None else None

    async def terminate(self, grace_seconds: int) -> Tuple[Optional[int], str]:
        """Gracefully stop the bot. Returns ``(exit_code, exit_reason)``.

        Order of escalation:

        1. Touch ``/tmp/bot-abort.signal`` — lets the bot flush its
           transcript queue and exit cleanly.
        2. Send SIGTERM.
        3. Wait up to ``grace_seconds``.
        4. Send SIGKILL if still alive.
        """
        if self._proc is None or self._proc.returncode is not None:
            # Already gone; surface whatever returncode we have so the
            # caller can still log a coherent response.
            existing = self._proc.returncode if self._proc is not None else None
            return existing, "already_exited"

        # Signal-file flush BEFORE SIGTERM so the bot sees the file as soon
        # as its signal handler runs.
        try:
            ABORT_SIGNAL_PATH.write_text("1", encoding="utf-8")
        except OSError as exc:
            self._logger.warning(
                "sidecar.bot.abort_signal.write_failed",
                error=str(exc),
            )

        try:
            self._proc.send_signal(signal.SIGTERM)
        except ProcessLookupError:
            # Race: process exited between is_alive check and the signal.
            return self._proc.returncode, "already_exited"

        self._logger.info(
            "sidecar.bot.terminate.sigterm",
            pid=self._proc.pid,
            grace_seconds=grace_seconds,
        )

        try:
            returncode = await asyncio.wait_for(
                self._proc.wait(), timeout=grace_seconds
            )
            return returncode, "graceful_exit"
        except asyncio.TimeoutError:
            self._logger.warning(
                "sidecar.bot.terminate.sigkill",
                pid=self._proc.pid,
            )
            try:
                self._proc.kill()
            except ProcessLookupError:
                pass
            returncode = await self._proc.wait()
            return returncode, "sigkill_after_timeout"
