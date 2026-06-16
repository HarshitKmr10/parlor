"""
Meeting Queue Service - Handles meeting job scheduling using pgqueuer
Built following the successful pattern from the workers folder
"""

import asyncio
import json
import logging
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Any, Dict, Optional

import asyncpg
from pgqueuer import PgQueuer
from pgqueuer.db import AsyncpgDriver

from src.db.python.dsn import normalize_postgres_dsn
from src.db.python.schema import meeting_joiner_schema, pgqueuer_schema, quote_identifier
from shared.config import database_config

logger = logging.getLogger(__name__)


class MeetingQueueService:
    """
    Meeting Queue Service using pgqueuer for job scheduling
    Follows the successful pattern from the workers folder
    """

    def __init__(self):
        self.pgq: Optional[PgQueuer] = None
        self.connection: Optional[asyncpg.Connection] = None
        self._initialized = False

    async def initialize(self):
        """Initialize the queue service with pgqueuer"""
        if self._initialized:
            return

        try:
            # Create direct database connection (not pooled) like workers folder
            self.connection = await asyncpg.connect(
                normalize_postgres_dsn(database_config.url),
                statement_cache_size=0,  # Disable for pgbouncer compatibility
            )

            # Set search path to pgqueuer schema
            await self.connection.execute(
                "SET search_path TO "
                f"{quote_identifier(pgqueuer_schema())}, "
                f"{quote_identifier(meeting_joiner_schema())}, "
                "pg_catalog"
            )

            # Create driver and pgqueuer instance
            driver = AsyncpgDriver(self.connection)
            self.pgq = PgQueuer(driver)

            # Register meeting processing entrypoint
            self._register_meeting_entrypoints()

            self._initialized = True
            logger.info("Meeting queue service initialized successfully")

        except Exception as e:
            logger.error(f"Failed to initialize meeting queue service: {e}")
            raise

    def _register_meeting_entrypoints(self):
        """Register entrypoints for processing different types of meeting jobs"""

        @self.pgq.entrypoint("join_meeting")
        async def process_meeting_join(job_id: str, payload: bytes):
            """Process meeting join jobs"""
            try:
                job_data = json.loads(payload.decode())
                meeting_id = job_data["meeting_id"]
                meeting_url = job_data["meeting_url"]

                logger.info(f"Processing meeting join for {meeting_id}")

                # Import here to avoid circular imports
                from services.bot_service import BotService
                from database.connection import get_db_connection
                from services.meeting_service import MeetingService

                # Initialize services
                db = await get_db_connection()
                meeting_service = MeetingService(db)
                bot_service = BotService()

                # Update meeting status to joining
                await meeting_service.update_meeting_status(meeting_id, "joining")

                # Start the bot to join the meeting
                success = await bot_service.join_meeting(meeting_id, meeting_url)

                if success:
                    logger.info(f"Successfully joined meeting {meeting_id}")
                    await meeting_service.update_meeting_status(meeting_id, "ongoing")
                else:
                    logger.error(f"Failed to join meeting {meeting_id}")
                    await meeting_service.update_meeting_status(meeting_id, "failed")

            except Exception as e:
                logger.error(f"Error processing meeting join job {job_id}: {e}")
                # Update meeting status to failed
                try:
                    from database.connection import get_db_connection
                    from services.meeting_service import MeetingService

                    db = await get_db_connection()
                    meeting_service = MeetingService(db)
                    await meeting_service.update_meeting_status(
                        job_data.get("meeting_id", "unknown"), "failed"
                    )
                except Exception as update_error:
                    logger.error(f"Failed to update meeting status: {update_error}")

        @self.pgq.entrypoint("stop_meeting")
        async def process_meeting_stop(job_id: str, payload: bytes):
            """Process meeting stop jobs"""
            try:
                job_data = json.loads(payload.decode())
                meeting_id = job_data["meeting_id"]

                logger.info(f"Processing meeting stop for {meeting_id}")

                # Import here to avoid circular imports
                from services.bot_service import BotService
                from database.connection import get_db_connection
                from services.meeting_service import MeetingService

                # Initialize services
                db = await get_db_connection()
                meeting_service = MeetingService(db)
                bot_service = BotService()

                # Stop the bot
                await bot_service.leave_meeting(meeting_id)

                # Update meeting status
                await meeting_service.update_meeting_status(meeting_id, "completed")

                logger.info(f"Successfully stopped meeting {meeting_id}")

            except Exception as e:
                logger.error(f"Error processing meeting stop job {job_id}: {e}")

    async def queue_meeting(
        self, meeting_id: str, meeting_url: str, delay_seconds: int = 0
    ) -> str:
        """
        Queue a meeting for processing

        Args:
            meeting_id: The meeting ID
            meeting_url: The meeting URL
            delay_seconds: Delay before processing (default: immediate)

        Returns:
            Job ID string
        """
        if not self._initialized:
            await self.initialize()

        try:
            from pgqueuer.queries import Queries

            # Create queries instance
            driver = AsyncpgDriver(self.connection)
            queries = Queries(driver)

            # Prepare job data
            job_data = {
                "meeting_id": meeting_id,
                "meeting_url": meeting_url,
                "action": "join_meeting",
                "created_at": datetime.utcnow().isoformat(),
            }

            payload = json.dumps(job_data).encode()

            # Schedule the job
            scheduled_at = None
            if delay_seconds > 0:
                from datetime import timedelta

                scheduled_at = datetime.utcnow() + timedelta(seconds=delay_seconds)

            # Enqueue the job
            job_ids = await queries.enqueue(
                ["join_meeting"],  # entrypoints
                [payload],  # payloads
                [0],  # priorities
                scheduled_at,  # scheduled_at
            )

            job_id = str(job_ids[0]) if job_ids else "unknown"
            logger.info(f"Queued meeting {meeting_id} with job ID {job_id}")

            return job_id

        except Exception as e:
            logger.error(f"Failed to queue meeting {meeting_id}: {e}")
            raise

    async def queue_meeting_stop(self, meeting_id: str, delay_seconds: int = 0) -> str:
        """Queue a meeting stop job"""
        if not self._initialized:
            await self.initialize()

        try:
            from pgqueuer.queries import Queries

            driver = AsyncpgDriver(self.connection)
            queries = Queries(driver)

            job_data = {
                "meeting_id": meeting_id,
                "action": "stop_meeting",
                "created_at": datetime.utcnow().isoformat(),
            }

            payload = json.dumps(job_data).encode()

            scheduled_at = None
            if delay_seconds > 0:
                from datetime import timedelta

                scheduled_at = datetime.utcnow() + timedelta(seconds=delay_seconds)

            job_ids = await queries.enqueue(
                ["stop_meeting"], [payload], [0], scheduled_at
            )

            job_id = str(job_ids[0]) if job_ids else "unknown"
            logger.info(f"Queued meeting stop {meeting_id} with job ID {job_id}")

            return job_id

        except Exception as e:
            logger.error(f"Failed to queue meeting stop {meeting_id}: {e}")
            raise

    @asynccontextmanager
    async def get_runner(self):
        """Context manager for running the queue consumer"""
        if not self._initialized:
            await self.initialize()
        try:
            yield self.pgq
        finally:
            if self.connection and not self.connection.is_closed():
                await self.connection.close()

    async def run_consumer(self):
        """Run the queue consumer (blocking)"""
        async with self.get_runner() as pgq:
            logger.info("Starting meeting queue consumer...")
            await pgq.run()

    async def cleanup(self):
        """Cleanup resources"""
        if self.connection and not self.connection.is_closed():
            await self.connection.close()
        self._initialized = False
        logger.info("Meeting queue service cleaned up")


# Global instance
meeting_queue_service = MeetingQueueService()
