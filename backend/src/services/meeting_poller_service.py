"""
Meeting Poller Service for PGQueuer Integration
Polls the database for meetings with 'not_joined' status and enqueues them for processing
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import List

from database.connection import get_db_connection
from models.schemas import MeetingStatus, MeetingRecord
from services.pgqueuer_queue_service import pgqueuer_queue_service

logger = logging.getLogger(__name__)


class MeetingPollerService:
    """
    Service that polls the database for meetings that need to be processed
    and automatically enqueues them in PGQueuer
    """

    def __init__(self, poll_interval_seconds: int = 30):
        """
        Initialize the poller service

        Args:
            poll_interval_seconds: How often to check for new meetings (default: 30 seconds)
        """
        self.poll_interval = poll_interval_seconds
        self.running = False
        self.processed_meeting_ids = (
            set()
        )  # Track processed meetings to avoid duplicates
        self._task = None

    async def start_polling(self):
        """Start the polling task"""
        if self.running:
            logger.warning("Poller is already running")
            return

        self.running = True
        logger.info(
            f"🔄 Starting meeting poller (checking every {self.poll_interval}s)"
        )

        self._task = asyncio.create_task(self._poll_loop())
        return self._task

    async def stop_polling(self):
        """Stop the polling task"""
        if not self.running:
            return

        logger.info("🛑 Stopping meeting poller...")
        self.running = False

        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

        logger.info("✅ Meeting poller stopped")

    async def _poll_loop(self):
        """Main polling loop"""
        try:
            while self.running:
                try:
                    await self._check_for_new_meetings()
                except Exception as e:
                    logger.error(f"Error in polling loop: {e}")

                # Wait for next poll interval
                try:
                    await asyncio.sleep(self.poll_interval)
                except asyncio.CancelledError:
                    break

        except asyncio.CancelledError:
            logger.info("Polling loop cancelled")
        except Exception as e:
            logger.error(f"Polling loop failed: {e}")

    async def _check_for_new_meetings(self):
        """Check database for meetings with 'not_joined' status"""
        try:
            # Get database connection
            db = await get_db_connection()

            # Query for meetings with 'not_joined' status
            # We can also add time filters to avoid processing very old meetings
            not_joined_meetings = await self._get_not_joined_meetings(db)

            if not not_joined_meetings:
                logger.debug("No meetings with 'not_joined' status found")
                return

            logger.info(
                f"📋 Found {len(not_joined_meetings)} meetings with 'not_joined' status"
            )

            # Process each meeting
            for meeting in not_joined_meetings:
                await self._process_meeting(meeting)

        except Exception as e:
            logger.error(f"Failed to check for new meetings: {e}")

    async def _get_not_joined_meetings(self, db) -> List[MeetingRecord]:
        """
        Get meetings with 'not_joined' status from the database
        Only get meetings created in the last 24 hours to avoid processing very old meetings
        """
        try:
            if not db._connected:
                await db.connect()

            twenty_four_hours_ago = datetime.utcnow() - timedelta(hours=24)
            rows = await db.store.list_meetings(
                where={"status": "not_joined"},
                order_by="created_at ASC",
                limit=200,
            )
            # Temporal filter applied client-side; the store doesn't carry
            # created_at >= bounds yet. Acceptable volume at the 24h window.
            recent = [r for r in rows if r.created_at and r.created_at >= twenty_four_hours_ago]
            return [db._row_to_record(r) for r in recent]
        except Exception as e:
            logger.error(f"Failed to query not_joined meetings: {e}")
            return []

    async def _process_meeting(self, meeting: MeetingRecord):
        """Process a single meeting by enqueueing it"""
        try:
            # Skip if we've already processed this meeting in this session
            if meeting.id in self.processed_meeting_ids:
                logger.debug(f"Meeting {meeting.id} already processed in this session")
                return

            logger.info(f"📝 Processing meeting {meeting.id}: {meeting.meeting_url}")

            # Enqueue the meeting for processing
            await pgqueuer_queue_service.queue_meeting(
                meeting_id=meeting.id,
                meeting_url=meeting.meeting_url,
                priority=1,  # Standard priority
            )

            # Mark as processed to avoid duplicate processing
            self.processed_meeting_ids.add(meeting.id)

            logger.info(f"✅ Successfully enqueued meeting {meeting.id}")

        except Exception as e:
            logger.error(f"Failed to process meeting {meeting.id}: {e}")

    async def poll_once(self):
        """Poll once for new meetings (useful for testing)"""
        logger.info("🔍 Performing one-time meeting poll...")
        await self._check_for_new_meetings()

    def get_stats(self) -> dict:
        """Get poller statistics"""
        return {
            "running": self.running,
            "poll_interval_seconds": self.poll_interval,
            "processed_meetings_count": len(self.processed_meeting_ids),
            "processed_meeting_ids": list(self.processed_meeting_ids),
        }


# Global instance
meeting_poller_service = MeetingPollerService()
