"""Unit tests for the meeting status state machine.

Two correctness goals:
1. Valid transitions accepted; invalid rejected with a clear error.
2. Exit reason classification matches the documented sets.
"""

from __future__ import annotations

import pytest

from src.api.models.schemas import MeetingStatus
from src.services.meeting_state_machine import (
    InvalidTransitionError,
    classify_exit_reason,
    is_recoverable_from,
    is_terminal,
    is_valid_transition,
    next_status_for_exit,
    validate_transition,
)


@pytest.mark.unit
class TestTransitionValidity:
    def test_forward_path_to_completion(self) -> None:
        path = [
            MeetingStatus.NOT_JOINED,
            MeetingStatus.JOINING,
            MeetingStatus.ONGOING,
            MeetingStatus.COMPLETED,
        ]
        for current, target in zip(path, path[1:]):
            validate_transition(current, target)  # must not raise

    def test_rejoin_cycle(self) -> None:
        # ongoing → interrupted → joining → ongoing → completed
        path = [
            MeetingStatus.ONGOING,
            MeetingStatus.INTERRUPTED,
            MeetingStatus.JOINING,
            MeetingStatus.ONGOING,
            MeetingStatus.COMPLETED,
        ]
        for current, target in zip(path, path[1:]):
            validate_transition(current, target)

    def test_idempotent_transition_allowed(self) -> None:
        validate_transition(MeetingStatus.ONGOING, MeetingStatus.ONGOING)

    def test_cannot_resurrect_terminal(self) -> None:
        with pytest.raises(InvalidTransitionError) as excinfo:
            validate_transition(MeetingStatus.COMPLETED, MeetingStatus.ONGOING)
        assert "completed" in str(excinfo.value)

    def test_cannot_resurrect_failed(self) -> None:
        with pytest.raises(InvalidTransitionError):
            validate_transition(MeetingStatus.FAILED, MeetingStatus.JOINING)

    def test_cannot_skip_joining_from_not_joined(self) -> None:
        # not_joined → ongoing is wrong; must pass through joining.
        with pytest.raises(InvalidTransitionError):
            validate_transition(MeetingStatus.NOT_JOINED, MeetingStatus.ONGOING)

    def test_failed_is_terminal(self) -> None:
        assert is_terminal(MeetingStatus.FAILED)
        assert is_terminal(MeetingStatus.COMPLETED)
        assert not is_terminal(MeetingStatus.ONGOING)
        assert not is_terminal(MeetingStatus.INTERRUPTED)

    def test_recoverable_from(self) -> None:
        assert is_recoverable_from(MeetingStatus.INTERRUPTED)
        assert is_recoverable_from(MeetingStatus.NOT_JOINED)
        assert not is_recoverable_from(MeetingStatus.COMPLETED)
        assert not is_recoverable_from(MeetingStatus.ONGOING)  # already in meeting

    def test_is_valid_transition_pure_check(self) -> None:
        assert is_valid_transition(
            MeetingStatus.JOINING, MeetingStatus.ONGOING
        )
        assert not is_valid_transition(
            MeetingStatus.COMPLETED, MeetingStatus.ONGOING
        )


@pytest.mark.unit
class TestExitReasonClassification:
    @pytest.mark.parametrize(
        "reason",
        [
            "removed",
            "left_alone_timeout",  # saw humans, everyone left → meeting ended
            "max_meeting_time",
            "alone",
            "bot_kicked",
            "org_max_duration",
            "memory_pressure",
        ],
    )
    def test_terminal_reasons(self, reason: str) -> None:
        assert classify_exit_reason(reason) == "terminal"

    @pytest.mark.parametrize(
        "reason",
        [
            "removed_before_admission",  # rejected at lobby — never joined
            "admission_rejected",
            "admission_timeout",
            "admission_unverified",
            "startup_alone_timeout",  # "admitted" UI but never saw anyone
        ],
    )
    def test_failed_reasons(self, reason: str) -> None:
        # "Never really joined" outcomes must classify as `failed`, not
        # `terminal` (which would mislabel them `completed`).
        assert classify_exit_reason(reason) == "failed"
        assert (
            next_status_for_exit(MeetingStatus.ONGOING, reason)
            == MeetingStatus.FAILED
        )

    @pytest.mark.parametrize(
        "reason",
        [
            "trackGone",
            "network_error",
            "platform_disconnect",
            "subprocess_crash",
            "sigterm_during_active",
            "pod_evicted",
        ],
    )
    def test_recoverable_reasons(self, reason: str) -> None:
        assert classify_exit_reason(reason) == "recoverable"

    def test_unknown_reason_defaults_to_unknown(self) -> None:
        assert classify_exit_reason("something_weird") == "unknown"
        assert classify_exit_reason("") == "unknown"
        assert classify_exit_reason(None) == "unknown"

    def test_next_status_for_terminal(self) -> None:
        assert (
            next_status_for_exit(MeetingStatus.ONGOING, "removed")
            == MeetingStatus.COMPLETED
        )

    def test_next_status_for_recoverable(self) -> None:
        assert (
            next_status_for_exit(MeetingStatus.ONGOING, "trackGone")
            == MeetingStatus.INTERRUPTED
        )

    def test_next_status_for_unknown_is_failed(self) -> None:
        # Defaulting unknown to FAILED prevents unbounded rejoin loops on
        # genuinely-broken bots.
        assert (
            next_status_for_exit(MeetingStatus.ONGOING, "mystery_exit_42")
            == MeetingStatus.FAILED
        )
