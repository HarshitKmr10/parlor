"""Regression test for the NameError in orphaned Zoom-bot cleanup.

`_terminate_orphaned_zoom_processes` used `pid_file` in the "found a stored
PID" branch without ever assigning it, raising a NameError that got swallowed
by the method's own broad `except Exception`, so `leave_meeting` silently
reported "no orphaned process found" even after actually killing one, and the
PID file was never cleaned up.
"""

from __future__ import annotations

import os
from unittest.mock import AsyncMock, patch

import pytest

from src.services.zoom_sdk_service import ZoomSDKService


def _pid_file_for(meeting_db_id: str) -> str:
    return f"/tmp/zoom_bot_pid_{meeting_db_id}.txt"


@pytest.mark.asyncio
async def test_terminate_orphaned_zoom_processes_kills_and_removes_pid_file():
    meeting_db_id = "meeting-orphan-1"
    pid_file = _pid_file_for(meeting_db_id)
    with open(pid_file, "w") as f:
        f.write("999999")

    service = ZoomSDKService()

    try:
        with patch.object(
            service, "_get_stored_pid_from_worker", new=AsyncMock(return_value=999999)
        ), patch.object(
            service, "_signal_termination", new=AsyncMock(return_value=False)
        ), patch("psutil.pid_exists", return_value=True), patch(
            "psutil.Process", return_value=object()
        ), patch(
            "os.kill"
        ) as kill_mock, patch(
            "asyncio.sleep", new=AsyncMock()
        ):
            result = await service._terminate_orphaned_zoom_processes(meeting_db_id)

        # Before the fix this raised NameError (swallowed by a broad except
        # Exception), which made leave_meeting silently report "not found".
        assert result is True
        kill_mock.assert_any_call(999999, 15)
        # The NameError bug meant this file was never removed even after a
        # successful kill; confirm the fix actually cleans it up.
        assert not os.path.exists(pid_file)
    finally:
        if os.path.exists(pid_file):
            os.remove(pid_file)


@pytest.mark.asyncio
async def test_terminate_orphaned_zoom_processes_stale_pid_cleans_up_file():
    """Covers the second `pid_file` reference: the `except NoSuchProcess`
    branch for a stored PID that no longer exists."""
    import psutil

    meeting_db_id = "meeting-orphan-2"
    pid_file = _pid_file_for(meeting_db_id)
    with open(pid_file, "w") as f:
        f.write("999998")

    service = ZoomSDKService()

    try:
        with patch.object(
            service, "_get_stored_pid_from_worker", new=AsyncMock(return_value=999998)
        ), patch.object(
            service, "_signal_termination", new=AsyncMock(return_value=False)
        ), patch(
            "psutil.pid_exists", side_effect=psutil.NoSuchProcess(999998)
        ):
            try:
                await service._terminate_orphaned_zoom_processes(meeting_db_id)
            except NameError:
                pytest.fail(
                    "_terminate_orphaned_zoom_processes raised NameError on pid_file"
                )

        # Before the fix, this branch also referenced the unassigned
        # `pid_file` name and would have raised NameError instead of
        # cleaning up the stale file.
        assert not os.path.exists(pid_file)
    finally:
        if os.path.exists(pid_file):
            os.remove(pid_file)
