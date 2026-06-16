"""Shared state holder for the meeting-worker sidecar.

The sidecar's lifecycle state is mutated from three places — the FastAPI route
handlers (``/configure``, ``/abort``), the background bot-supervisor task
(when the subprocess exits), and the periodic health poller (which derives
``stuck`` from heartbeat staleness). Centralising mutations on
``SidecarStateManager`` keeps the locking contract simple: every mutator
acquires the same ``asyncio.Lock`` and emits a state-transition log line.

Why not a frozen dataclass? The state must change over the pod's lifetime
(warm -> configuring -> joining -> in_meeting -> ended). Immutable snapshots
are still produced via ``snapshot()`` so route handlers can read consistent
values without holding the lock.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field, replace
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from .models import ConfigureRequest


class MeetingState(str, Enum):
    """Lifecycle states of the meeting-worker pod.

    String values match the wire literal in ``HealthResponse.meeting_state``
    so the enum can be serialised directly by FastAPI / pydantic.
    """

    WARM = "warm"
    CONFIGURING = "configuring"
    JOINING = "joining"
    IN_MEETING = "in_meeting"
    ENDED = "ended"
    STUCK = "stuck"


@dataclass(frozen=True)
class SidecarStateSnapshot:
    """Immutable view of sidecar state at a moment in time.

    Route handlers receive these so they can read consistent values without
    holding the state lock for the duration of response serialisation.
    """

    meeting_state: MeetingState
    current_meeting_id: Optional[str]
    current_session_number: Optional[int]
    bot_pid: Optional[int]
    bot_returncode: Optional[int]
    exit_reason: Optional[str]
    started_at: datetime
    config: Optional[ConfigureRequest]


@dataclass
class SidecarState:
    """Mutable internal state. Mutate ONLY through ``SidecarStateManager``."""

    meeting_state: MeetingState = MeetingState.WARM
    current_meeting_id: Optional[str] = None
    current_session_number: Optional[int] = None
    bot_pid: Optional[int] = None
    bot_returncode: Optional[int] = None
    exit_reason: Optional[str] = None
    started_at: datetime = field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    config: Optional[ConfigureRequest] = None

    def snapshot(self) -> SidecarStateSnapshot:
        """Produce an immutable view of the current state."""
        # RCA #31: ConfigureRequest is a Pydantic BaseModel, not a
        # @dataclass. `dataclasses.replace` only works on dataclasses;
        # use Pydantic's model_copy() to get an independent copy.
        config_copy = self.config.model_copy() if self.config is not None else None
        return SidecarStateSnapshot(
            meeting_state=self.meeting_state,
            current_meeting_id=self.current_meeting_id,
            current_session_number=self.current_session_number,
            bot_pid=self.bot_pid,
            bot_returncode=self.bot_returncode,
            exit_reason=self.exit_reason,
            started_at=self.started_at,
            config=config_copy,
        )


class SidecarStateManager:
    """Async-safe wrapper around ``SidecarState``.

    Every mutator method acquires ``self._lock`` and emits a structured log
    line for the transition. Route handlers and the supervisor must never
    touch ``self._state`` fields directly; use a method or ``snapshot()``.
    """

    def __init__(self) -> None:
        self._state = SidecarState()
        self._lock = asyncio.Lock()
        # Lazy import to avoid circular dependency at module import time.
        from src.observability import get_logger

        self._logger = get_logger("sidecar.state")

    def _log_transition(
        self,
        *,
        from_state: MeetingState,
        to_state: MeetingState,
        meeting_id: Optional[str],
        session_number: Optional[int],
    ) -> None:
        """Emit a single structured log line per state transition."""
        self._logger.info(
            "sidecar.state.transition",
            from_state=from_state.value,
            to_state=to_state.value,
            meeting_id=meeting_id,
            session_number=session_number,
        )

    async def snapshot(self) -> SidecarStateSnapshot:
        """Return an immutable view of state. Cheap; safe from any task."""
        async with self._lock:
            return self._state.snapshot()

    async def mark_configuring(self, config: ConfigureRequest, pid: int) -> None:
        """Transition WARM -> CONFIGURING after spawning the bot subprocess."""
        async with self._lock:
            prev = self._state.meeting_state
            self._state.meeting_state = MeetingState.CONFIGURING
            self._state.current_meeting_id = config.meeting_id
            self._state.current_session_number = config.session_number
            self._state.config = config
            self._state.bot_pid = pid
            self._state.bot_returncode = None
            self._state.exit_reason = None
            self._log_transition(
                from_state=prev,
                to_state=MeetingState.CONFIGURING,
                meeting_id=config.meeting_id,
                session_number=config.session_number,
            )

    async def mark_state(self, new_state: MeetingState) -> None:
        """Transition to a derived state (JOINING / IN_MEETING / STUCK).

        No-op when already in that state, so health-poller idempotence is
        preserved and we don't spam logs every tick.
        """
        async with self._lock:
            prev = self._state.meeting_state
            if prev == new_state:
                return
            self._state.meeting_state = new_state
            self._log_transition(
                from_state=prev,
                to_state=new_state,
                meeting_id=self._state.current_meeting_id,
                session_number=self._state.current_session_number,
            )

    async def mark_ended(
        self, *, returncode: Optional[int], exit_reason: str
    ) -> None:
        """Record subprocess exit. Idempotent — first wins."""
        async with self._lock:
            if self._state.meeting_state == MeetingState.ENDED:
                return
            prev = self._state.meeting_state
            self._state.meeting_state = MeetingState.ENDED
            self._state.bot_returncode = returncode
            self._state.exit_reason = exit_reason
            self._log_transition(
                from_state=prev,
                to_state=MeetingState.ENDED,
                meeting_id=self._state.current_meeting_id,
                session_number=self._state.current_session_number,
            )

    async def clear_bot_pid(self) -> None:
        """Drop the PID once the OS has reaped the subprocess."""
        async with self._lock:
            self._state.bot_pid = None
