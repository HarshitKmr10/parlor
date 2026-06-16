#!/usr/bin/env python3
"""
Meeting Queue Worker - Processes meeting jobs using pgqueuer
Simplified version that only handles on-demand jobs, not scheduled ones
"""

import asyncio
import json
import logging
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncGenerator

import asyncpg
from pgqueuer import PgQueuer
from pgqueuer.db import AsyncpgDriver

sys.path.append(str(Path(__file__).parent.parent))

from shared.config import database_config
from src.db.python.dsn import normalize_postgres_dsn
from src.db.python.schema import meeting_joiner_schema, pgqueuer_schema, quote_identifier
from database.connection import get_db_connection
from services.meeting_service import MeetingService

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


async def create_pgqueuer() -> PgQueuer:
    """Create and configure a PgQueuer instance with meeting entrypoints"""

    # Create direct database connection (following workers pattern)
    connection = await asyncpg.connect(
        normalize_postgres_dsn(database_config.url),
        statement_cache_size=0,  # Disable for pgbouncer compatibility
    )

    # Set search path to pgqueuer schema
    await connection.execute(
        "SET search_path TO "
        f"{quote_identifier(pgqueuer_schema())}, "
        f"{quote_identifier(meeting_joiner_schema())}, "
        "pg_catalog"
    )

    # Create driver and PgQueuer instance
    driver = AsyncpgDriver(connection)
    pgq = PgQueuer(driver)

    # Register meeting job entrypoints (only on-demand, no schedules)
    @pgq.entrypoint("join_meeting")
    async def process_meeting_join(job_id: str, payload: bytes):
        """Process meeting join jobs"""
        try:
            job_data = json.loads(payload.decode())
            meeting_id = job_data["meeting_id"]
            meeting_url = job_data["meeting_url"]

            logger.info(f"Processing meeting join for {meeting_id}")

            # Initialize services
            db = await get_db_connection()
            meeting_service = MeetingService(db)

            # Update meeting status to joining
            await meeting_service.update_meeting_status(meeting_id, "joining")

            # Start the bot to join the meeting (import locally to avoid circular imports)
            try:
                from services.bot_service import BotService

                bot_service = BotService()
                success = await bot_service.join_meeting(meeting_id, meeting_url)

                if success:
                    logger.info(f"Successfully joined meeting {meeting_id}")
                    await meeting_service.update_meeting_status(meeting_id, "ongoing")
                else:
                    logger.error(f"Failed to join meeting {meeting_id}")
                    await meeting_service.update_meeting_status(meeting_id, "failed")

            except ImportError:
                logger.warning(
                    f"Bot service not available, simulating join for {meeting_id}"
                )

                # For now, just call the existing Node.js bot script
                import subprocess
                import os

                try:
                    # Change to the meeting-joiner directory
                    os.chdir(Path(__file__).parent.parent)

                    # Call the Node.js meeting processor
                    result = subprocess.run(
                        ["node", "meetingProcessor.js", meeting_url, meeting_id],
                        capture_output=True,
                        text=True,
                        timeout=90,
                    )

                    if result.returncode == 0:
                        logger.info(
                            f"Successfully started Node.js bot for meeting {meeting_id}"
                        )
                        await meeting_service.update_meeting_status(
                            meeting_id, "ongoing"
                        )
                    else:
                        logger.error(
                            f"Node.js bot failed for meeting {meeting_id}: {result.stderr}"
                        )
                        await meeting_service.update_meeting_status(
                            meeting_id, "failed"
                        )

                except subprocess.TimeoutExpired:
                    logger.error(f"Node.js bot timed out for meeting {meeting_id}")
                    await meeting_service.update_meeting_status(meeting_id, "failed")
                except Exception as e:
                    logger.error(
                        f"Error starting Node.js bot for meeting {meeting_id}: {e}"
                    )
                    await meeting_service.update_meeting_status(meeting_id, "failed")

        except Exception as e:
            logger.error(f"Error processing meeting join job {job_id}: {e}")
            # Update meeting status to failed
            try:
                db = await get_db_connection()
                meeting_service = MeetingService(db)
                await meeting_service.update_meeting_status(
                    job_data.get("meeting_id", "unknown"), "failed"
                )
            except Exception as update_error:
                logger.error(f"Failed to update meeting status: {update_error}")

    @pgq.entrypoint("stop_meeting")
    async def process_meeting_stop(job_id: str, payload: bytes):
        """Process meeting stop jobs"""
        try:
            job_data = json.loads(payload.decode())
            meeting_id = job_data["meeting_id"]

            logger.info(f"Processing meeting stop for {meeting_id}")

            # Initialize services
            db = await get_db_connection()
            meeting_service = MeetingService(db)

            # Try to stop the bot gracefully
            try:
                from services.bot_service import BotService

                bot_service = BotService()
                await bot_service.leave_meeting(meeting_id)
            except ImportError:
                # If bot service is not available, just update the status
                logger.warning(
                    f"Bot service not available for stopping meeting {meeting_id}"
                )

            # Update meeting status to completed
            await meeting_service.update_meeting_status(meeting_id, "completed")

            logger.info(f"Successfully stopped meeting {meeting_id}")

        except Exception as e:
            logger.error(f"Error processing meeting stop job {job_id}: {e}")

    return pgq


async def run_worker():
    """Run the meeting queue worker"""
    logger.info("Setting up Meeting Queue Worker with PgQueuer")
    try:
        await get_db_connection()

        pgq = await create_pgqueuer()

        logger.info("Meeting Queue Worker initialized successfully")
        logger.info("Starting Meeting Queue Worker consumer...")

        # Run the worker (this will block)
        await pgq.run()

    except Exception as e:
        logger.error(f"Failed to run Meeting Queue Worker: {e}")
        raise
    finally:
        logger.info("Meeting Queue Worker stopped")


if __name__ == "__main__":
    try:
        asyncio.run(run_worker())
    except KeyboardInterrupt:
        logger.info("\nShutting down Meeting Queue Worker...")
    except Exception as e:
        logger.exception("Critical failure in Meeting Queue Worker: %s", e)
        sys.exit(1)
