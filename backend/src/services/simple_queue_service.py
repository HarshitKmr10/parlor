"""
Simple Queue Service using Prisma and meeting_joiner table
Based on the original queueApi.py approach - simple and effective
"""

import json
import logging
from datetime import datetime
from typing import Optional, Dict, Any

from database.connection import get_db_connection, DatabaseConnection
from models.schemas import MeetingStatus

logger = logging.getLogger(__name__)


class SimpleQueueService:
    """Simple queue service using Prisma and meeting_joiner table"""

    def __init__(self):
        self.db: Optional[DatabaseConnection] = None
        self._initialized = False

    async def initialize(self):
        """Initialize the queue service"""
        if self._initialized:
            return

        try:
            # Get database connection using existing pattern
            self.db = await get_db_connection()

            self._initialized = True
            logger.info("Simple queue service initialized successfully")

        except Exception as e:
            logger.error(f"Failed to initialize simple queue service: {e}")
            raise

    async def queue_meeting(self, meeting_id: str, meeting_url: str) -> str:
        """Queue a meeting for processing - this creates a meeting_joiner record"""
        if not self._initialized:
            await self.initialize()

        try:
            # Check if meeting already exists
            existing_meeting = await self.db.get_meeting(meeting_id)

            if existing_meeting:
                # Update existing meeting to not_joined status
                await self.db.update_meeting_status(
                    meeting_id, MeetingStatus.NOT_JOINED
                )
                logger.info(f"Updated existing meeting {meeting_id} to not_joined")
            else:
                # Create new meeting record
                meeting = await self.db.create_meeting(meeting_url)
                meeting_id = meeting.id
                logger.info(f"Created new meeting {meeting_id}")

            return meeting_id

        except Exception as e:
            logger.error(f"Failed to queue meeting {meeting_id}: {e}")
            raise

    async def queue_meeting_stop(self, meeting_id: str) -> str:
        """Queue a meeting stop job - signal the bot to leave, then mark completed"""
        if not self._initialized:
            await self.initialize()

        try:
            # Import here to avoid a hard dependency at module import time.
            from services.meeting_processor_bridge import meeting_processor_bridge

            # Signal the actual bot process to leave the call BEFORE marking
            # the meeting completed in the DB. Without this, the bot keeps
            # recording indefinitely even though the DB reports it done.
            stop_result = await meeting_processor_bridge.stop_meeting(meeting_id)
            if not stop_result.get("success"):
                raise RuntimeError(
                    f"Failed to signal bot to leave meeting {meeting_id}: "
                    f"{stop_result.get('message')}"
                )

            # Only flip the DB status once the stop signal is confirmed sent.
            await self.db.update_meeting_status(meeting_id, MeetingStatus.COMPLETED)
            logger.info(f"Queued meeting stop {meeting_id}")
            return meeting_id

        except Exception as e:
            logger.error(f"Failed to queue meeting stop {meeting_id}: {e}")
            raise

    async def get_next_job(self, entrypoint: str = "join_meeting"):
        """Get the next job from the queue using Prisma"""
        if not self._initialized:
            await self.initialize()

        try:
            if entrypoint == "join_meeting":
                # FOR UPDATE SKIP LOCKED claim of the next not_joined meeting.
                # Same SQL as before; routed through the pluggable store so it
                # works under both the prisma and pg drivers.
                claimed = await self.db.store.claim_next_join_job()

                if claimed is not None:
                    job_data = {
                        "meeting_id": claimed.id,
                        "meeting_url": claimed.meeting_url,
                        "action": "join_meeting",
                        "created_at": datetime.utcnow().isoformat(),
                    }
                    job = SimpleJob(claimed.id, job_data)
                    logger.info(f"Dequeued job {claimed.id} for {entrypoint}")
                    return {"job_id": claimed.id, "data": job_data, "job": job}

            elif entrypoint == "stop_meeting":
                # For now, we'll handle stop differently - could look for meetings that need to be stopped
                return None

            return None

        except Exception as e:
            logger.error(f"Failed to get next job: {e}")
            return None

    async def complete_job(self, job):
        """Mark a job as completed"""
        try:
            # Update meeting status to completed
            await self.db.update_meeting_status(job.id, MeetingStatus.COMPLETED)
            logger.info(f"Completed job {job.id}")

        except Exception as e:
            logger.error(f"Failed to complete job {job.id}: {e}")

    async def fail_job(self, job, error_message: str = ""):
        """Mark a job as failed - for now, we'll set it back to not_joined for retry"""
        try:
            # Set back to not_joined for potential retry
            await self.db.update_meeting_status(job.id, MeetingStatus.NOT_JOINED)
            logger.error(f"Failed job {job.id}: {error_message}")

        except Exception as e:
            logger.error(f"Failed to mark job {job.id} as failed: {e}")

    async def cleanup(self):
        """Cleanup resources"""
        if self.db:
            await self.db.disconnect()
        self._initialized = False
        logger.info("Simple queue service cleaned up")


class SimpleJob:
    """Simple job object to mimic pgqueuer Job interface"""

    def __init__(self, job_id: str, data: Dict[str, Any]):
        self.id = job_id
        self.data = data
        self.payload = json.dumps(data).encode()


# Global instance
simple_queue_service = SimpleQueueService()
