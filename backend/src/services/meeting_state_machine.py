"""Meeting status state machine.

Replaces the one-way `not_joined → ongoing → completed` rule (was at
``meeting_processor_bridge.py:115-140``) that prevented rejoin states. With
the warm-pool architecture, a meeting can be `interrupted` (bot died /
dropped) and resumed via the rejoin orchestrator.

State diagram:

    not_joined ──► joining ──► ongoing ──┬──► completed
                                          │
                                          └──► interrupted ──► joining ──► ongoing
                                                    │                          │
                                                    └──► failed                └─► completed

`failed` is reached only from `interrupted` after rejoin attempts are
exhausted or from `joining` if admission times out repeatedly.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import FrozenSet, Mapping

from src.api.models.schemas import MeetingStatus

# Map of valid forward transitions. Backwards transitions (e.g. completed →
# ongoing) are NEVER allowed — terminal states are terminal.
_VALID_TRANSITIONS: Mapping[MeetingStatus, FrozenSet[MeetingStatus]] = {
    MeetingStatus.NOT_JOINED: frozenset(
        {MeetingStatus.JOINING, MeetingStatus.FAILED, MeetingStatus.COMPLETED}
    ),
    MeetingStatus.JOINING: frozenset(
        {
            MeetingStatus.ONGOING,
            MeetingStatus.INTERRUPTED,
            MeetingStatus.FAILED,
            MeetingStatus.COMPLETED,
        }
    ),
    MeetingStatus.ONGOING: frozenset(
        {
            MeetingStatus.INTERRUPTED,
            MeetingStatus.COMPLETED,
            MeetingStatus.FAILED,
        }
    ),
    MeetingStatus.INTERRUPTED: frozenset(
        {
            MeetingStatus.JOINING,
            MeetingStatus.COMPLETED,
            MeetingStatus.FAILED,
        }
    ),
    MeetingStatus.COMPLETED: frozenset(),  # terminal
    MeetingStatus.FAILED: frozenset(),  # terminal
}


class InvalidTransitionError(ValueError):
    """Raised when a caller attempts an unsupported state transition."""

    def __init__(self, current: MeetingStatus, target: MeetingStatus) -> None:
        self.current = current
        self.target = target
        super().__init__(
            f"Invalid meeting status transition: {current.value} → {target.value}. "
            f"Allowed from {current.value}: "
            f"{sorted(s.value for s in _VALID_TRANSITIONS[current])}"
        )


@dataclass(frozen=True)
class TransitionRequest:
    """Audit-trail-friendly description of a transition.

    Kept frozen so callers can stash it in logs / events without worrying
    about mutation between read and persist.
    """

    meeting_id: str
    current: MeetingStatus
    target: MeetingStatus
    reason: str  # event name: "bot.admitted", "rejoin.failed", "max_meeting_time"
    session_number: int


def is_valid_transition(current: MeetingStatus, target: MeetingStatus) -> bool:
    """Pure check — does NOT raise. Useful for branch logic."""
    if current == target:
        # Idempotent transitions (status already at target) are allowed.
        return True
    return target in _VALID_TRANSITIONS.get(current, frozenset())


def validate_transition(current: MeetingStatus, target: MeetingStatus) -> None:
    """Raise :class:`InvalidTransitionError` if the transition isn't allowed."""
    if not is_valid_transition(current, target):
        raise InvalidTransitionError(current, target)


def is_terminal(status: MeetingStatus) -> bool:
    """``True`` for terminal states (`completed`, `failed`)."""
    return not _VALID_TRANSITIONS.get(status, frozenset())


def is_recoverable_from(status: MeetingStatus) -> bool:
    """``True`` if a rejoin can resume from this status."""
    return MeetingStatus.JOINING in _VALID_TRANSITIONS.get(status, frozenset())


# Exit reason classification — drives whether status moves to `interrupted`
# (rejoin) or `completed`/`failed`. Bot code calls
# :func:`classify_exit_reason` with the raw reason string from the bot
# subprocess and the state machine moves the meeting accordingly.
_TERMINAL_EXIT_REASONS: FrozenSet[str] = frozenset(
    {
        "removed",  # host removed the bot (it WAS in the meeting)
        "removed_by_admin",  # msteams: removed post-admission
        "max_meeting_time",  # bot hit its own max-duration guard
        "alone",  # bot was alone in the meeting past the alone-grace
        "left_alone_timeout",  # saw humans, everyone then left → meeting ended
        "exited_clean",  # bot subprocess exited 0 with no specific reason
        "bot_kicked",
        "org_max_duration",  # per-org policy hit
        "memory_pressure",  # bot OOM-soft-monitor tripped
    }
)

# "Never really joined" outcomes. The bot either was rejected at the lobby,
# timed out waiting for admission, or detected the in-call UI shell but never
# established a real connection (no roster, no audio frames — a limbo false
# positive). These are FAILURES, not completed meetings, and must NOT rejoin
# (the same rejection would just repeat). NOTE: `removed_before_admission`
# lives here, not in the terminal/completed set — a bot denied at the lobby
# never joined, so it is `failed`, not `completed`. (This also corrects the
# Teams bot, which correctly emits `removed_before_admission` on rejection.)
_FAILED_EXIT_REASONS: FrozenSet[str] = frozenset(
    {
        "removed_before_admission",  # rejected/denied at the lobby
        "admission_rejected",  # explicit "You can't join this video call"
        "admission_timeout",  # never admitted within the timeout
        "admission_unverified",  # in-call shell but no real connection (limbo)
        "admission_failed",  # generic pre-join failure
        "startup_alone_timeout",  # "admitted" but never saw anyone — bad join
        "prejoin_controls_not_found",  # msteams: prejoin form never rendered
        "join_button_not_found",  # msteams: "Join now" never appeared
    }
)

_RECOVERABLE_EXIT_REASONS: FrozenSet[str] = frozenset(
    {
        "trackGone",  # gmeet: WebRTC tracks all went silent
        "remote_tracks_gone",  # msteams: remote audio tracks dropped → rejoin
        "network_error",
        "platform_disconnect",
        "subprocess_crash",
        "sigterm_during_active",  # pod was killed mid-meeting (k8s drain)
        "pod_evicted",  # pod disappeared from k8s API (node failure, evict)
        "stuck_no_heartbeat",  # bot hung; warm-pool reaper killed the pod
        "audio_capture_no_tracks",  # gmeet: media never attached → rejoin fresh
    }
)


def classify_exit_reason(reason: str | None) -> str:
    """Return ``"terminal"``, ``"failed"``, ``"recoverable"``, or ``"unknown"``.

    - ``terminal``  → the meeting ran and ended normally (→ ``completed``)
    - ``failed``    → the bot never really joined (→ ``failed``, no rejoin)
    - ``recoverable`` → a transient fault mid-meeting (→ ``interrupted``, rejoin)
    - ``unknown``   → defaults to ``failed`` so a mystery exit doesn't loop
    """
    if not reason:
        return "unknown"
    if reason in _TERMINAL_EXIT_REASONS:
        return "terminal"
    if reason in _FAILED_EXIT_REASONS:
        return "failed"
    if reason in _RECOVERABLE_EXIT_REASONS:
        return "recoverable"
    return "unknown"


def next_status_for_exit(
    current: MeetingStatus, exit_reason: str | None
) -> MeetingStatus:
    """Compute the next status based on the exit reason classification.

    Caller still has to :func:`validate_transition` the result — this
    function only proposes; it does NOT enforce validity. That separation
    keeps the policy easy to test in isolation from the schema.
    """
    classification = classify_exit_reason(exit_reason)
    if classification == "terminal":
        return MeetingStatus.COMPLETED
    if classification == "recoverable":
        return MeetingStatus.INTERRUPTED
    # "failed" (never joined) and "unknown" both go to FAILED so the meeting
    # is not mislabeled completed and does not loop on rejoin.
    return MeetingStatus.FAILED
