"""
PGQueuer Queue Service for Meeting Joiner
High-performance queue service using PGQueuer for better scalability
Following patterns from workers/ and backend/pgqueuer_service/
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

import asyncpg
from pgqueuer import JobId, PgQueuer
from pgqueuer.db import AsyncpgDriver
from pgqueuer.queries import Queries
from pgqueuer.models import Job
from pgqueuer.executors import RetryWithBackoffEntrypointExecutor

from src.db.python.dsn import normalize_postgres_dsn
from src.db.python.schema import pgqueuer_schema, qualified_name, quote_identifier
from shared.config import database_config
from src.api.models.schemas import MeetingStatus

logger = logging.getLogger(__name__)


class PgQueuerQueueService:
    """
    High-performance queue service using PGQueuer
    Replaces the simple database-based queue for better scalability
    """

    def __init__(self):
        self.connection: Optional[asyncpg.Connection] = None
        self.pgq: Optional[PgQueuer] = None
        self.queries: Optional[Queries] = None
        self._initialized = False
        # Pod-level meeting lock to ensure only one meeting per container
        self._meeting_lock = asyncio.Lock()

    async def initialize(self):
        """Initialize the PGQueuer service"""
        if self._initialized:
            return

        try:
            # Create direct database connection (not pooled) following workers pattern
            self.connection = await asyncpg.connect(
                normalize_postgres_dsn(database_config.direct_url),
                statement_cache_size=0,  # Disable for pgbouncer compatibility
            )

            # Set search path to pgqueuer (where the tables actually exist)
            schema = pgqueuer_schema()
            await self.connection.execute(
                f"SET search_path TO {quote_identifier(schema)}, pg_catalog"
            )

            # Create driver and PgQueuer instance
            driver = AsyncpgDriver(self.connection)
            self.pgq = PgQueuer(driver)
            self.queries = Queries(driver)

            # Register entrypoints for meeting processing
            self._register_meeting_entrypoints()

            self._initialized = True
            logger.info("PGQueuer queue service initialized successfully")

        except Exception as e:
            logger.error(f"Failed to initialize PGQueuer queue service: {e}")
            raise

    async def _verify_schema(self):
        """Verify that the pgqueuer tables exist, create them if needed"""
        try:
            # Check if main table exists in pgqueuer schema
            table_exists = await self.connection.fetchval(
                """
                SELECT EXISTS(
                    SELECT 1 FROM information_schema.tables 
                    WHERE table_schema = $1 AND table_name = 'pgqueuer'
                )
                """,
                pgqueuer_schema(),
            )

            if not table_exists:
                logger.info("📦 PGQueuer tables not found, installing...")
                # Let PGQueuer create its tables
                await self.queries.install()
                logger.info("✅ PGQueuer tables created successfully")
            else:
                logger.info("✅ PGQueuer schema verification passed")

        except Exception as e:
            logger.error(f"❌ PGQueuer schema verification/installation failed: {e}")
            raise

    def _register_meeting_entrypoints(self):
        """Register meeting processing entrypoints with retry logic"""

        @self.pgq.entrypoint(
            "join_meeting",
            executor_factory=lambda parameters: RetryWithBackoffEntrypointExecutor(
                parameters=parameters,
                max_attempts=3,  # Retry failed jobs up to 3 times
                max_delay=timedelta(seconds=300),  # Max 5 minutes delay
                initial_delay=2,  # Start with 2 second delay
                backoff_multiplier=2,  # Double delay each retry
                max_time=timedelta(minutes=480),
            ),
        )
        async def process_meeting_join(job: Job) -> None:
            """Process meeting join jobs with retry logic"""
            try:
                logger.info(f"🎯 Processing PGQueuer job {job.id}")
                job_data = json.loads(job.payload.decode())
                meeting_id = job_data["meeting_id"]
                meeting_url = job_data["meeting_url"]

                logger.info(f"📋 Job details - Meeting ID: {meeting_id}")
                logger.info(f"🔗 Job details - Meeting URL: {meeting_url}")
                logger.info(f"💼 Job details - Full payload: {job_data}")

                # 🔒 POD-LEVEL MEETING LOCK - Only one meeting per container
                # Check if this worker is already processing a meeting - requeue instead of waiting
                if self._meeting_lock.locked():
                    logger.info(f"🔄 Worker busy - requeuing meeting {meeting_id} for another worker")
                    await self.queries.enqueue(
                        "join_meeting",
                        job.payload,
                        execute_after=timedelta(seconds=5),  # Short delay before retry
                    )
                    return  # Exit cleanly - job requeued

                async with self._meeting_lock:
                    logger.info(f"✅ Pod lock acquired - starting meeting {meeting_id}")
                    logger.info(f"🎯 This pod is now exclusively processing meeting {meeting_id}")

                    # Import here to avoid circular imports
                    logger.info(f"📦 Importing meeting processor bridge...")
                    from ..services.meeting_processor_bridge import meeting_processor_bridge

                    logger.info(f"✅ Meeting processor bridge imported successfully")

                    # Process the meeting using the bridge service
                    logger.info(
                        f"🚀 Calling meeting processor bridge for meeting {meeting_id}..."
                    )

                    # Extract bot_name from job payload
                    bot_name = job_data.get("bot_name", "Meeting Bot")
                    logger.info(f"🤖 Job payload bot name: {bot_name}")

                    result = await meeting_processor_bridge.process_meeting(
                        meeting_id, meeting_url, bot_name
                    )
                    logger.info(
                        f"🎯 Bridge returned result for meeting {meeting_id}: {result}"
                    )
                    logger.info(f"🔓 Meeting {meeting_id} completed - releasing pod lock")

                if result.get("success"):
                    logger.info(f"✅ Successfully processed meeting {meeting_id}")
                else:
                    logger.error(
                        f"❌ Failed to process meeting {meeting_id}: {result.get('message')}"
                    )
                    # Don't raise exception if it's a legitimate failure (bot joined but no recording)
                    # Only raise if it's a real error that should trigger retry
                    if "timeout" in result.get("message", "").lower():
                        logger.warning(
                            f"⚠️ Raising exception for timeout to trigger retry"
                        )
                        raise Exception(
                            f"Meeting processing failed: {result.get('message')}"
                        )

                logger.info(f"🏁 Completed processing PGQueuer job {job.id}")

            except Exception as e:
                logger.error(f"💥 Error processing meeting join job {job.id}: {e}")
                logger.exception(f"Full exception details for job {job.id}")
                # Let the retry executor handle retries
                raise

        @self.pgq.entrypoint(
            "stop_meeting",
            executor_factory=lambda parameters: RetryWithBackoffEntrypointExecutor(
                parameters=parameters,
                max_attempts=2,  # Stop jobs need fewer retries
                max_delay=timedelta(seconds=60),
                initial_delay=1,
                backoff_multiplier=2,
            ),
        )
        async def process_meeting_stop(job: Job) -> None:
            """Process meeting stop jobs"""
            try:
                job_data = json.loads(job.payload.decode())
                meeting_id = job_data["meeting_id"]

                logger.info(f"Processing meeting stop for {meeting_id}")

                # Import here to avoid circular imports
                from ..services.meeting_processor_bridge import meeting_processor_bridge

                # Signal the actual bot process/sidecar/pod to leave the call
                # BEFORE marking the meeting completed in the DB. Without this,
                # the bot keeps recording indefinitely and never frees its
                # warm-pool slot even though the DB reports the meeting done.
                stop_result = await meeting_processor_bridge.stop_meeting(meeting_id)
                if not stop_result.get("success"):
                    raise RuntimeError(
                        f"Failed to signal bot to leave meeting {meeting_id}: "
                        f"{stop_result.get('message')}"
                    )

                # Only flip the DB status once the stop signal is confirmed sent.
                from ..api.database.connection import get_db_connection
                from ..services.meeting_service import MeetingService

                db = await get_db_connection()
                meeting_service = MeetingService(db)
                await meeting_service.update_meeting_status(
                    meeting_id, MeetingStatus.COMPLETED
                )

                logger.info(f"Successfully stopped meeting {meeting_id}")

            except Exception as e:
                logger.error(f"Error processing meeting stop job {job.id}: {e}")
                # Re-raise so PGQueuer's retry executor retries the stop instead
                # of silently reporting success on a bot that never got the signal.
                raise

    async def queue_meeting(
        self,
        meeting_id: str,
        meeting_url: str,
        bot_name: Optional[str] = None,
        priority: int = 0,
    ) -> str:
        """
        Queue a meeting for processing using PGQueuer

        Args:
            meeting_id: UUID of the meeting
            meeting_url: Teams meeting URL
            bot_name: Name of the bot
            priority: Job priority (higher numbers = higher priority)

        Returns:
            Job ID from PGQueuer
        """
        if not self._initialized:
            await self.initialize()

        try:
            job_data = {
                "meeting_id": meeting_id,
                "meeting_url": meeting_url,
                "action": "join_meeting",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "bot_name": bot_name,
            }

            # Enqueue job using PGQueuer - fix API call
            await self.queries.enqueue(
                "join_meeting",  # entrypoint as string
                json.dumps(job_data).encode(),  # payload as bytes
                priority,  # priority as int
            )

            logger.info(f"Queued meeting {meeting_id}")
            return "job_queued"  # Return a success indicator

        except Exception as e:
            logger.error(f"Failed to queue meeting {meeting_id}: {e}")
            raise

    async def queue_meeting_stop(self, meeting_id: str, priority: int = 5) -> str:
        """
        Queue a meeting stop job using PGQueuer

        Args:
            meeting_id: UUID of the meeting
            priority: Job priority (stop jobs should have higher priority)

        Returns:
            Job ID from PGQueuer
        """
        if not self._initialized:
            await self.initialize()

        try:
            job_data = {
                "meeting_id": meeting_id,
                "action": "stop_meeting",
                "created_at": datetime.now(timezone.utc).isoformat(),
            }

            # Enqueue stop job with higher priority - fix API call
            await self.queries.enqueue(
                "stop_meeting",  # entrypoint as string
                json.dumps(job_data).encode(),  # payload as bytes
                priority,  # priority as int
            )

            logger.info(f"Queued meeting stop {meeting_id}")
            return "stop_job_queued"  # Return a success indicator

        except Exception as e:
            logger.error(f"Failed to queue meeting stop {meeting_id}: {e}")
            raise

    async def get_next_job(
        self, entrypoint: str = "join_meeting"
    ) -> Optional[Dict[str, Any]]:
        """
        Get the next job from PGQueuer
        This method is mainly for compatibility with existing code
        In practice, PGQueuer handles job consumption automatically
        """
        if not self._initialized:
            await self.initialize()

        try:
            # PGQueuer handles job consumption automatically through the registered entrypoints
            # This method is kept for compatibility but shouldn't be used in normal operations
            logger.warning(
                "get_next_job() called - PGQueuer handles job consumption automatically"
            )
            return None

        except Exception as e:
            logger.error(f"Error in get_next_job: {e}")
            return None

    async def get_queue_stats(self) -> Dict[str, Any]:
        """Get queue statistics from PGQueuer"""
        if not self._initialized:
            await self.initialize()

        try:
            # Query queue statistics
            stats_query = """
                SELECT 
                    entrypoint,
                    status,
                    COUNT(*) as count
                FROM {table}
                GROUP BY entrypoint, status
                ORDER BY entrypoint, status
            """.format(table=qualified_name("pgqueuer", pgqueuer_schema()))

            stats = await self.connection.fetch(stats_query)

            # Format stats
            formatted_stats = {}
            for stat in stats:
                entrypoint = stat["entrypoint"]
                if entrypoint not in formatted_stats:
                    formatted_stats[entrypoint] = {}
                formatted_stats[entrypoint][stat["status"]] = stat["count"]

            return formatted_stats

        except Exception as e:
            logger.error(f"Failed to get queue stats: {e}")
            return {}

    async def cancel_job(self, job_id: int) -> bool:
        """Cancel a specific job by ID"""
        if not self._initialized:
            await self.initialize()

        try:
            await self.queries.mark_job_as_cancelled([JobId(job_id)])
            logger.info(f"Cancelled job {job_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to cancel job {job_id}: {e}")
            return False

    async def start_consumer(self):
        """Start the PGQueuer consumer (blocking operation)"""
        if not self._initialized:
            await self.initialize()

        logger.info("🚀 Starting PGQueuer consumer with job requeue on busy workers...")
        logger.info("🔄 REQUEUE ENABLED: Jobs hitting busy workers are requeued for other workers")
        logger.info("🎯 This prevents X11/PulseAudio resource sharing between meetings")
        logger.info("⚙️ Using asyncio.Lock() with requeue for better cluster utilization")
        logger.info("🔧 PGQueuer config: dequeue_timeout=5s, batch_size=1, requeue_delay=5s")
        try:
            # Use application-level locking (asyncio.Lock) with requeue instead of blocking
            # This ensures only ONE meeting can use virtual_speaker.monitor and DISPLAY :99 per pod
            # Configure PGQueuer for better job distribution across multiple workers
            await self.pgq.run(
                dequeue_timeout=timedelta(seconds=5),  # Shorter timeout for more responsive polling
                batch_size=1,  # Process one job at a time for better distribution
            )
        except Exception as e:
            logger.error(f"Error in PGQueuer consumer: {e}")
            raise

    async def cleanup(self):
        """Cleanup resources"""
        if self.connection:
            await self.connection.close()
        self._initialized = False
        logger.info("PGQueuer queue service cleaned up")


# Global instance
pgqueuer_queue_service = PgQueuerQueueService()


# Compatibility layer for existing code
class PgQueuerJob:
    """Job wrapper for compatibility with existing code"""

    def __init__(self, job_id: str, data: Dict[str, Any]):
        self.id = job_id
        self.data = data
        self.payload = json.dumps(data).encode()
