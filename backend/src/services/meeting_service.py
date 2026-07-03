"""
Meeting Service - Business logic for meeting operations
"""

import logging
from datetime import datetime, timedelta, timezone

UTC = timezone.utc
from typing import Any, Dict, List, Optional
import os
import shutil
import tempfile
import glob

from shared.exceptions import DatabaseError, MeetingNotFoundError
from ..api.database.connection import DatabaseConnection
from ..api.models.schemas import (
    FormattedTranscript,
    MeetingRecord,
    MeetingStatus,
    TranscriptEntry,
)

logger = logging.getLogger(__name__)


class MeetingService:
    """Service class for meeting business logic"""

    def __init__(self, db: DatabaseConnection):
        self.db = db

    async def create_meeting(
        self,
        meeting_url: str,
        org_id: Optional[str] = None,
        bot_name: Optional[str] = None,
        transcript_source: Optional[str] = None,
        scheduled_at: Optional[datetime] = None,
    ) -> MeetingRecord:
        """Create a new meeting record"""
        try:
            meeting = await self.db.create_meeting(
                meeting_url, org_id, bot_name, transcript_source, scheduled_at
            )
            logger.info(
                f"Meeting service: Created meeting {meeting.id} "
                f"(transcript_source={transcript_source or 'default'}, "
                f"scheduled_at={scheduled_at.isoformat() if scheduled_at else 'none'})"
            )
            return meeting

        except Exception as e:
            logger.error(f"Meeting service: Failed to create meeting: {e}")
            raise DatabaseError(f"Failed to create meeting: {e}")

    async def get_meeting_by_id(self, meeting_id: str) -> Optional[MeetingRecord]:
        """Get meeting by ID"""
        try:
            meeting = await self.db.get_meeting(meeting_id)
            if not meeting:
                logger.warning(f"Meeting service: Meeting {meeting_id} not found")
            return meeting

        except Exception as e:
            logger.error(f"Meeting service: Failed to get meeting {meeting_id}: {e}")
            raise DatabaseError(f"Failed to retrieve meeting: {e}")

    async def update_meeting_status(
        self, meeting_id: str, status: MeetingStatus, **additional_data
    ) -> MeetingRecord:
        """Update meeting status"""
        try:
            meeting = await self.db.update_meeting_status(
                meeting_id, status, **additional_data
            )
            logger.info(
                f"Meeting service: Updated meeting {meeting_id} status to {status}"
            )
            return meeting

        except Exception as e:
            logger.error(f"Meeting service: Failed to update meeting {meeting_id}: {e}")
            raise DatabaseError(f"Failed to update meeting status: {e}")

    async def claim_for_rejoin(self, meeting_id: str) -> bool:
        """Single-flight guard for rejoin — see DatabaseConnection.claim_for_rejoin."""
        return await self.db.claim_for_rejoin(meeting_id)

    async def complete_if_active(self, meeting_id: str) -> bool:
        """Guarded stop-completion — see DatabaseConnection.complete_if_active."""
        return await self.db.complete_if_active(meeting_id)

    async def update_transcript(
        self, meeting_id: str, transcript_data: Dict[str, Any]
    ) -> Optional[MeetingRecord]:
        """Update meeting transcript"""
        try:
            # Validate and format transcript data
            formatted_transcript = self._validate_transcript_data(transcript_data)

            meeting = await self.db.update_transcript(meeting_id, formatted_transcript)
            if meeting:
                logger.debug(
                    f"Meeting service: Updated transcript for meeting {meeting_id}"
                )
            return meeting

        except Exception as e:
            logger.error(
                f"Meeting service: Failed to update transcript for {meeting_id}: {e}"
            )
            # Don't raise error for transcript updates to avoid breaking meeting flow
            return None

    async def update_participants(
        self, meeting_id: str, participants: List[Dict[str, Any]]
    ) -> Optional[MeetingRecord]:
        """Update meeting participants"""
        try:
            # Validate and format participant data
            formatted_participants: List[Dict[str, Any]] = (
                self._validate_participant_data(participants)
            )

            meeting = await self.db.update_participants(
                meeting_id, formatted_participants
            )
            if meeting:
                logger.debug(
                    f"Meeting service: Updated participants for meeting {meeting_id}"
                )
            return meeting

        except Exception as e:
            logger.error(
                f"Meeting service: Failed to update participants for {meeting_id}: {e}"
            )
            return None

    async def get_active_meetings(
        self, org_id: Optional[str] = None
    ) -> List[MeetingRecord]:
        """Get all active meetings"""
        try:
            meetings = await self.db.get_active_meetings(org_id)
            logger.info(f"Meeting service: Retrieved {len(meetings)} active meetings")
            return meetings

        except Exception as e:
            logger.error(f"Meeting service: Failed to get active meetings: {e}")
            raise DatabaseError(f"Failed to retrieve active meetings: {e}")

    async def get_meetings_by_org(
        self, org_id: str, status: Optional[MeetingStatus] = None
    ) -> List[MeetingRecord]:
        """Get meetings by organization"""
        try:
            meetings = await self.db.get_meetings_by_org(org_id, status)
            logger.info(
                f"Meeting service: Retrieved {len(meetings)} meetings for org {org_id}"
            )
            return meetings

        except Exception as e:
            logger.error(
                f"Meeting service: Failed to get meetings for org {org_id}: {e}"
            )
            raise DatabaseError(f"Failed to retrieve meetings: {e}")

    async def list_meetings(
        self,
        org_id: Optional[str] = None,
        statuses: Optional[List[MeetingStatus]] = None,
        since: Optional[datetime] = None,
        until: Optional[datetime] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[MeetingRecord]:
        """List meetings for the dashboard with filter + pagination support."""
        try:
            return await self.db.list_meetings(
                org_id=org_id,
                statuses=statuses,
                since=since,
                until=until,
                limit=limit,
                offset=offset,
            )
        except Exception as e:
            logger.error(f"Meeting service: Failed to list meetings: {e}")
            raise DatabaseError(f"Failed to list meetings: {e}")

    async def count_meetings(
        self,
        org_id: Optional[str] = None,
        statuses: Optional[List[MeetingStatus]] = None,
        since: Optional[datetime] = None,
        until: Optional[datetime] = None,
    ) -> int:
        """Best-effort total count for the same filter set as ``list_meetings``."""
        try:
            return await self.db.count_meetings(
                org_id=org_id, statuses=statuses, since=since, until=until
            )
        except Exception as e:
            logger.error(f"Meeting service: Failed to count meetings: {e}")
            raise DatabaseError(f"Failed to count meetings: {e}")

    async def format_transcript(
        self,
        raw_transcript: Optional[Dict[str, Any]],
        format: str = "detailed",
        include_speakers: bool = True,
        since: Optional[datetime] = None,
    ) -> FormattedTranscript:
        """Format transcript data based on requested format.

        ``since`` lets the dashboard fetch only entries newer than the last
        timestamp it has seen, which keeps polling cheap on long meetings.
        """
        if not raw_transcript:
            return FormattedTranscript(entries=[])

        try:
            content = raw_transcript.get("content", [])

            if format == "raw":
                if since is not None:
                    content = [
                        c for c in content
                        if isinstance(c, dict)
                        and self._parse_timestamp(c.get("timestamp")) is not None
                        and self._parse_timestamp(c.get("timestamp")) > since
                    ]
                return FormattedTranscript(entries=content)

            # Extract transcript entries
            entries = []

            for item in content:
                if isinstance(item, dict):
                    parsed_ts = self._parse_timestamp(item.get("timestamp"))
                    if since is not None and parsed_ts is not None and parsed_ts <= since:
                        continue
                    # Get text content and filter short segments. Threshold
                    # honors the same MIN_SEGMENT_TEXT_LENGTH env override as
                    # the persistence path; default is 10.
                    text_content = item.get("text", "") or item.get("content", "")

                    try:
                        min_len = int(os.environ.get("MIN_SEGMENT_TEXT_LENGTH", "10"))
                    except ValueError:
                        min_len = 10
                    if len(text_content.strip()) < min_len:
                        continue

                    raw_conf = item.get("confidence")
                    # confidence is Optional[float]; coerce non-numeric
                    # values (legacy data with attribution-source strings)
                    # to None instead of letting Pydantic blow up the
                    # whole response.
                    try:
                        conf = float(raw_conf) if raw_conf is not None else None
                    except (TypeError, ValueError):
                        conf = None
                    try:
                        entry = TranscriptEntry(
                            timestamp=parsed_ts,
                            speaker=(
                                item.get("speaker", "Unknown")
                                if include_speakers
                                else "Speaker"
                            ),
                            content=text_content,
                            confidence=conf,
                        )
                        entries.append(entry)
                    except Exception as e:
                        logger.warning(
                            "Skipping malformed transcript entry: %s", e
                        )
                        continue

            # Handle text_only format - return concatenated text
            if format == "text_only":
                concatenated_text = " ".join([entry.content for entry in entries])
                return FormattedTranscript(
                    entries=[
                        TranscriptEntry(
                            timestamp=datetime.now(UTC),
                            speaker="",
                            content=concatenated_text,
                            confidence=None,
                        )
                    ]
                )

            # Generate summary and key points for detailed format
            summary = None
            key_points = None
            action_items = None

            if format == "detailed":
                summary = self._generate_summary(entries)
                key_points = self._extract_key_points(entries)
                action_items = self._extract_action_items(entries)

            return FormattedTranscript(
                entries=entries,
                summary=summary,
                key_points=key_points,
                action_items=action_items,
            )

        except Exception as e:
            logger.error(f"Meeting service: Failed to format transcript: {e}")
            return FormattedTranscript(entries=[])

    def _validate_transcript_data(
        self, transcript_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Validate and format transcript data"""
        if not isinstance(transcript_data, dict):
            # Convert non-dict to safe dict structure
            return {
                "content": str(transcript_data) if transcript_data is not None else "",
                "timestamp": datetime.now(UTC).isoformat(),
                "format": "converted",
                "original_type": str(type(transcript_data)),
            }

        # Ensure required fields and JSON-serializable values
        formatted = {
            "timestamp": self._ensure_json_serializable(
                transcript_data.get("timestamp", datetime.now(UTC).isoformat())
            ),
            "content": self._ensure_json_serializable(
                transcript_data.get("content", [])
            ),
            "lastUpdated": self._ensure_json_serializable(
                transcript_data.get(
                    "lastUpdated", int(datetime.now(UTC).timestamp() * 1000)
                )
            ),
        }

        # Add any additional fields, ensuring they're JSON-serializable
        for key, value in transcript_data.items():
            if key not in formatted:
                formatted[key] = self._ensure_json_serializable(value)

        # Validate content format
        if not isinstance(formatted["content"], (list, str, dict)):
            formatted["content"] = []

        return formatted

    def _ensure_json_serializable(self, value: Any) -> Any:
        """Ensure a value is JSON-serializable"""
        try:
            import json

            # Test if value can be serialized
            json.dumps(value)
            return value
        except (TypeError, ValueError):
            # If not serializable, convert to string representation
            if value is None:
                return None
            elif isinstance(value, (datetime,)):
                return value.isoformat()
            elif hasattr(value, "__dict__"):
                return str(value)  # Convert objects to string
            else:
                return str(value)

    def _validate_participant_data(
        self, participants: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Validate and format participant data"""
        if not isinstance(participants, list):
            raise ValueError("Participants data must be a list")

        formatted_participants: List[Dict[str, Any]] = []
        for participant in participants:
            if isinstance(participant, dict):
                formatted = {
                    "id": participant.get(
                        "id", f"participant-{len(formatted_participants)}"
                    ),
                    "name": participant.get("name", "Unknown"),
                    "email": participant.get("email"),
                    "joinedAt": participant.get(
                        "joinedAt", datetime.now(UTC).isoformat()
                    ),
                    "leftAt": participant.get("leftAt"),
                    "isPresent": participant.get("isPresent", True),
                }
                formatted_participants.append(formatted)

        return formatted_participants

    def _parse_timestamp(self, timestamp_str: Any) -> datetime:
        """Parse timestamp from various formats"""
        if isinstance(timestamp_str, datetime):
            return timestamp_str

        if isinstance(timestamp_str, str):
            try:
                return datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
            except ValueError:
                pass

        # Default to current time if parsing fails
        return datetime.now(UTC)

    def _generate_summary(self, entries: List[TranscriptEntry]) -> Optional[str]:
        """Generate a basic meeting summary"""
        if not entries:
            return None

        # Basic summary generation (can be enhanced with AI/NLP)
        total_entries = len(entries)
        speakers = set(entry.speaker for entry in entries)

        if total_entries > 0:
            return f"Meeting with {len(speakers)} participants and {total_entries} transcript entries"

        return None

    def _extract_key_points(
        self, entries: List[TranscriptEntry]
    ) -> Optional[List[str]]:
        """Extract key points from transcript"""
        if not entries:
            return None

        # Basic key point extraction (can be enhanced with AI/NLP)
        key_points = []

        # Look for common patterns that indicate important points
        for entry in entries:
            content_lower = entry.content.lower()
            if any(
                phrase in content_lower
                for phrase in ["important", "key", "decision", "conclusion", "summary"]
            ):
                key_points.append(
                    entry.content[:100] + "..."
                    if len(entry.content) > 100
                    else entry.content
                )

        return key_points[:5] if key_points else None  # Limit to top 5

    def _extract_action_items(
        self, entries: List[TranscriptEntry]
    ) -> Optional[List[str]]:
        """Extract action items from transcript"""
        if not entries:
            return None

        # Basic action item extraction (can be enhanced with AI/NLP)
        action_items = []

        # Look for common patterns that indicate action items
        for entry in entries:
            content_lower = entry.content.lower()
            if any(
                phrase in content_lower
                for phrase in [
                    "action item",
                    "todo",
                    "follow up",
                    "will do",
                    "need to",
                    "should",
                ]
            ):
                action_items.append(
                    entry.content[:100] + "..."
                    if len(entry.content) > 100
                    else entry.content
                )

        return action_items[:10] if action_items else None  # Limit to top 10

    async def cleanup_meeting_data(self, max_hours: int = 8) -> None:
        """
        Clean up meeting data folders that are older than max_hours

        Args:
            max_hours: Maximum hours before cleaning up meeting data (default: 8)
        """
        try:
            # Define base paths
            base_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            processors_base_path = os.path.join(base_path, "processors", "meeting_data")
            bot_scripts_base_path = os.path.join(
                base_path, "bot", "bot_scripts", "meeting_data"
            )
            temp_base_path = os.path.join(tempfile.gettempdir(), "meeting_data")

            # Calculate cutoff time
            cutoff_time = datetime.now() - timedelta(hours=max_hours)

            # Helper function to clean up folders older than cutoff_time
            def cleanup_old_folders(base_path: str) -> None:
                if not os.path.exists(base_path):
                    return

                # List all meeting folders (they are named with timestamps)
                meeting_folders = glob.glob(os.path.join(base_path, "*"))

                for folder in meeting_folders:
                    try:
                        # Get folder creation time
                        folder_stat = os.stat(folder)
                        create_time = datetime.fromtimestamp(folder_stat.st_ctime)

                        # If folder is older than cutoff time, remove it
                        if create_time < cutoff_time:
                            # Check if folder contains expected file types (.json, .wav, .mp4)
                            has_meeting_files = any(
                                f.endswith((".json", ".wav", ".mp4"))
                                for f in os.listdir(folder)
                            )

                            if has_meeting_files:
                                shutil.rmtree(folder)
                                folder_name = os.path.basename(folder)
                                logger.info(
                                    f"Cleaned up meeting data folder {folder_name} "
                                    f"(created {(datetime.now() - create_time).total_seconds() / 3600:.1f} hours ago)"
                                )

                    except Exception as e:
                        folder_name = os.path.basename(folder)
                        logger.error(f"Failed to process folder {folder_name}: {e}")

            # Clean up old folders in all locations
            cleanup_old_folders(processors_base_path)
            cleanup_old_folders(bot_scripts_base_path)
            cleanup_old_folders(temp_base_path)

        except Exception as e:
            logger.error(f"Failed to clean up meeting data folders: {e}")

    async def cleanup_stale_meetings(self, max_hours: int = 8) -> int:
        """
        Clean up meetings that have been in 'ongoing' status for more than max_hours
        This prevents meetings from getting stuck in ongoing status indefinitely

        Args:
            max_hours: Maximum hours a meeting can stay in ongoing status (default: 8)

        Returns:
            Number of meetings that were cleaned up
        """
        try:
            await self.db.connect() if not self.db._connected else None

            # Calculate cutoff time (8 hours ago)
            cutoff_time = datetime.now(UTC) - timedelta(hours=max_hours)

            # Find ongoing meetings that are older than 8 hours via the
            # store's typed surface (works under both prisma + pg drivers).
            stale_meetings = await self.db.store.list_meetings(
                where={"status": "ongoing"},
                order_by="bot_join_time DESC",
                limit=200,
            )
            stale_meetings = [m for m in stale_meetings if m.bot_join_time and m.bot_join_time < cutoff_time]

            cleanup_count = 0

            for meeting in stale_meetings:
                try:
                    # Safely handle transcript data - ensure it's a valid dict
                    existing_transcript = meeting.transcript or {}
                    if not isinstance(existing_transcript, dict):
                        existing_transcript = {}

                    # Create new transcript with cleanup metadata
                    updated_transcript = {
                        **existing_transcript,
                        "cleanup_reason": f"Auto-completed after {max_hours} hours",
                        "cleanup_timestamp": datetime.now(UTC).isoformat(),
                    }

                    # Update meeting status to completed with cleanup metadata
                    await self.update_meeting_status(
                        meeting.id,
                        MeetingStatus.COMPLETED,
                        bot_leave_time=datetime.now(UTC),
                        transcript=updated_transcript,
                    )

                    cleanup_count += 1
                    logger.info(
                        f"Auto-completed stale meeting {meeting.id} "
                        f"(ongoing for {(datetime.now(UTC) - meeting.bot_join_time).total_seconds() / 3600:.1f} hours)"
                    )

                except Exception as e:
                    logger.error(f"Failed to cleanup meeting {meeting.id}: {e}")
                    # Try a minimal safe cleanup without transcript update
                    try:
                        await self.update_meeting_status(
                            meeting.id,
                            MeetingStatus.COMPLETED,
                            bot_leave_time=datetime.now(UTC),
                        )
                        cleanup_count += 1
                        logger.info(
                            f"Auto-completed stale meeting {meeting.id} (minimal cleanup)"
                        )
                    except Exception as fallback_error:
                        logger.error(
                            f"Even fallback cleanup failed for meeting {meeting.id}: {fallback_error}"
                        )
                    continue

            # After handling stale meetings, clean up old meeting data folders
            await self.cleanup_meeting_data(max_hours)

            if cleanup_count > 0:
                logger.info(f"Cleaned up {cleanup_count} stale meetings")
            else:
                logger.debug("No stale meetings found for cleanup")

            return cleanup_count

        except Exception as e:
            logger.error(f"Failed to cleanup stale meetings: {e}")
            return 0

    async def append_transcript_segment(
        self, meeting_id: str, segment_data: Dict[str, Any]
    ) -> Optional[MeetingRecord]:
        """Append a new transcript segment to existing meeting transcript"""
        try:
            # Validate and format the segment data
            formatted_segment = self._validate_segment_data(segment_data)

            meeting = await self.db.append_transcript_segment(
                meeting_id, formatted_segment
            )
            if meeting:
                logger.debug(
                    f"Meeting service: Appended transcript segment to meeting {meeting_id}"
                )
            return meeting

        except Exception as e:
            logger.error(
                f"Meeting service: Failed to append transcript segment for {meeting_id}: {e}"
            )
            # Don't raise error for transcript updates to avoid breaking meeting flow
            return None

    def _validate_segment_data(self, segment_data: Dict[str, Any]) -> Dict[str, Any]:
        """Validate and format a single transcript segment"""
        if not isinstance(segment_data, dict):
            # Convert non-dict to safe dict structure
            return {
                "content": str(segment_data) if segment_data is not None else "",
                "timestamp": datetime.now(UTC).isoformat(),
                "format": "converted_segment",
                "original_type": str(type(segment_data)),
            }

        # Ensure required fields and JSON-serializable values
        formatted_segment = {
            "timestamp": self._ensure_json_serializable(
                segment_data.get("timestamp", datetime.now(UTC).isoformat())
            ),
            "speaker": self._ensure_json_serializable(
                segment_data.get("speaker", "Unknown")
            ),
            "text": self._ensure_json_serializable(
                segment_data.get("text", segment_data.get("content", ""))
            ),
            "startTime": self._ensure_json_serializable(
                segment_data.get("startTime", segment_data.get("start_time", 0))
            ),
            "endTime": self._ensure_json_serializable(
                segment_data.get("endTime", segment_data.get("end_time", 0))
            ),
            "confidence": self._ensure_json_serializable(
                segment_data.get("confidence")
            ),
            "chunk": self._ensure_json_serializable(segment_data.get("chunk")),
            "isRealTime": True,
            "appendedAt": datetime.now(UTC).isoformat(),
        }

        # Add any additional fields, ensuring they're JSON-serializable
        for key, value in segment_data.items():
            if key not in formatted_segment:
                formatted_segment[key] = self._ensure_json_serializable(value)

        # Clean up empty/None values except for confidence which can be None
        cleaned_segment = {}
        for key, value in formatted_segment.items():
            if value is not None or key == "confidence":
                cleaned_segment[key] = value

        return cleaned_segment

    async def update_meeting_pod(
        self,
        meeting_id: str,
        pod_name: Optional[str],
        cluster_name: Optional[str] = None,
    ) -> None:
        """Record which k8s pod is running this meeting.

        Used by the warm-pool dispatcher in :mod:`src.services.warm_pool_dispatcher`
        and by the rejoin orchestrator when a meeting moves between pods.
        """
        try:
            if not self.db._connected:
                await self.db.connect()
            fields: dict[str, Optional[str]] = {"pod_name": pod_name}
            if cluster_name is not None:
                fields["cluster_name"] = cluster_name
            await self.db.store.update_fields(meeting_id, fields)
            logger.info(
                "Recorded pod assignment meeting_id=%s pod_name=%s cluster=%s",
                meeting_id,
                pod_name,
                cluster_name,
            )
        except Exception as e:
            logger.error(f"Failed to record pod assignment: {e}")
            raise DatabaseError(f"Failed to record pod assignment: {e}")

    async def terminate_meeting_process(self, meeting_id: str) -> bool:
        """Request termination of a running meeting's bot.

        Pod-per-meeting refactor: the bot subprocess is no longer tracked by a
        DB-persisted OS PID. Termination is signalled by marking the meeting
        ``completed`` — the worker that owns the subprocess polls this via
        :meth:`check_if_externally_stopped` and terminates the process through
        its in-memory handle (see
        ``meeting_processor_bridge.monitor_with_stop_check``). This is also
        correct across workers/pods, where an ``os.kill`` by PID could never
        reach a process running on another host.
        """
        try:
            await self.update_meeting_status(meeting_id, MeetingStatus.COMPLETED)
            logger.info(
                f"🛑 Signalled stop for meeting {meeting_id} "
                "(status=completed; owning worker terminates the bot subprocess)"
            )
            return True
        except Exception as e:
            logger.error(f"💥 Failed to signal stop for meeting {meeting_id}: {e}")
            return False

    async def check_if_externally_stopped(self, meeting_id: str) -> bool:
        """
        Check if a meeting was externally stopped (status changed to completed while ongoing).
        Used for cross-pod termination - worker polls this during processing.
        
        Args:
            meeting_id: UUID of the meeting
            
        Returns:
            True if meeting status is 'completed' (external stop signal), False otherwise
        """
        try:
            if not self.db._connected:
                await self.db.connect()
            meeting = await self.db.store.get_meeting(meeting_id)
            # If status changed to completed, external termination was requested
            if meeting and meeting.status == "completed":
                logger.info(f"🛑 External stop detected for meeting {meeting_id} (status=completed)")
                return True
            return False
        except Exception as e:
            logger.error(f"Failed to check meeting status for {meeting_id}: {e}")
            return False

