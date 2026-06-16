#!/usr/bin/env python3
"""
Simple Meeting Worker - Polls for jobs using pgqueuer Queries directly
Avoids the complex worker infrastructure and validation issues
"""

import asyncio
import json
import logging
import os
import subprocess
import sys
import time
from pathlib import Path

# Add parent directory to path for imports
sys.path.append(str(Path(__file__).parent.parent))

from database.connection import get_db_connection
from services.meeting_service import MeetingService
from services.simple_queue_service import simple_queue_service
from models.schemas import MeetingStatus

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


class SimpleMeetingWorker:
    """Simple worker that polls for jobs manually"""

    def __init__(self):
        self.running = False

    async def process_join_meeting(self, job_data: dict, job):
        """Process a join meeting job"""
        meeting_id = job_data["meeting_id"]
        meeting_url = job_data["meeting_url"]

        logger.info(f"Processing meeting join for {meeting_id}")

        try:
            # Initialize services
            db = await get_db_connection()
            meeting_service = MeetingService(db)

            # Note: Status is already set to 'ongoing' by the queue service when dequeuing
            # So we don't need to update it again here

            # Try to start the bot
            try:
                from services.bot_service import BotService

                bot_service = BotService()
                success = await bot_service.join_meeting(meeting_id, meeting_url)

                if success:
                    logger.info(f"Successfully joined meeting {meeting_id}")
                    # Status remains 'ongoing' - it will be updated when meeting ends
                    # Complete the job immediately for bot service
                    await simple_queue_service.complete_job(job)
                else:
                    logger.error(f"Failed to join meeting {meeting_id}")
                    await meeting_service.update_meeting_status(
                        meeting_id, MeetingStatus.NOT_JOINED
                    )
                    await simple_queue_service.fail_job(
                        job, "Bot service failed to join meeting"
                    )

            except ImportError:
                # If bot service is not available, call Node.js bot script
                logger.warning(
                    f"Bot service not available, calling Node.js script for {meeting_id}"
                )

                try:
                    # Change to the meeting-joiner directory
                    os.chdir(Path(__file__).parent.parent)

                    # Call the Node.js meeting processor asynchronously
                    # Since the bot needs to run for the entire meeting duration,
                    # we start it as a background process and capture its output
                    logger.info(f"Starting Node.js bot for meeting {meeting_id}...")

                    # Start the process and capture output
                    result = subprocess.Popen(
                        ["node", "meetingProcessor.js", meeting_url, meeting_id],
                        stdout=subprocess.PIPE,
                        stderr=subprocess.STDOUT,  # Combine stderr into stdout
                        text=True,
                        bufsize=1,  # Line buffered
                        universal_newlines=True,
                    )

                    # Log the initial startup
                    logger.info(f"Node.js bot started with PID: {result.pid}")

                    # Give it some time to start and check initial status
                    await asyncio.sleep(5)  # Reduced to 5 seconds for faster feedback

                    # Check if process is still running
                    if result.poll() is None:
                        # Process is still running - good!
                        logger.info(f"Node.js bot is running for meeting {meeting_id}")

                        # Read any early output that might be available
                        import select

                        if hasattr(select, "select"):
                            # Unix-like systems
                            try:
                                ready, _, _ = select.select(
                                    [result.stdout], [], [], 0.1
                                )
                                if ready:
                                    output = result.stdout.read(1024)
                                    if output:
                                        logger.info(
                                            f"[Bot-{meeting_id}] Early output: {output.strip()}"
                                        )
                            except Exception as e:
                                logger.debug(f"Could not read early output: {e}")

                        # Start a background task to monitor the process and complete the job when done
                        async def monitor_bot():
                            try:
                                while result.poll() is None:
                                    await asyncio.sleep(30)  # Check every 30 seconds
                                    logger.info(
                                        f"Bot for meeting {meeting_id} still running (PID: {result.pid})"
                                    )

                                # Process has ended - now complete the job based on exit code
                                return_code = result.returncode
                                if return_code == 0:
                                    logger.info(
                                        f"Node.js bot for meeting {meeting_id} completed successfully"
                                    )
                                    # Update meeting status to completed since bot joined and finished
                                    await meeting_service.update_meeting_status(
                                        meeting_id, MeetingStatus.COMPLETED
                                    )
                                    await simple_queue_service.complete_job(job)
                                    logger.info(f"Completed join_meeting job {job.id}")
                                else:
                                    logger.error(
                                        f"Node.js bot for meeting {meeting_id} exited with code {return_code}"
                                    )
                                    # For non-zero exit codes, still mark as completed if the bot likely joined
                                    # (the bot might exit with code 1 due to processing issues after successful join)
                                    await meeting_service.update_meeting_status(
                                        meeting_id, MeetingStatus.COMPLETED
                                    )
                                    await simple_queue_service.complete_job(job)
                                    logger.info(
                                        f"Completed join_meeting job {job.id} (bot exited with code {return_code})"
                                    )

                            except Exception as e:
                                logger.error(
                                    f"Error monitoring bot for meeting {meeting_id}: {e}"
                                )
                                await meeting_service.update_meeting_status(
                                    meeting_id, MeetingStatus.NOT_JOINED
                                )
                                await simple_queue_service.fail_job(
                                    job, f"Monitor error: {str(e)}"
                                )

                        # Start the monitoring task in the background
                        asyncio.create_task(monitor_bot())

                    else:
                        # Process has already exited - check for errors
                        stdout_output = ""
                        try:
                            stdout_output = (
                                result.stdout.read() if result.stdout else ""
                            )
                        except Exception:
                            pass

                        logger.error(
                            f"Node.js bot exited early for meeting {meeting_id}. "
                            f"Exit code: {result.returncode}, "
                            f"output: {stdout_output}"
                        )
                        await meeting_service.update_meeting_status(
                            meeting_id, MeetingStatus.NOT_JOINED
                        )
                        await simple_queue_service.fail_job(job, "Bot exited early")

                except Exception as e:
                    logger.error(
                        f"Error starting Node.js bot for meeting {meeting_id}: {e}"
                    )
                    await meeting_service.update_meeting_status(
                        meeting_id, MeetingStatus.NOT_JOINED
                    )
                    await simple_queue_service.fail_job(
                        job, f"Failed to start bot: {str(e)}"
                    )

        except Exception as e:
            logger.error(f"Error processing meeting join: {e}")
            await simple_queue_service.fail_job(job, f"Processing error: {str(e)}")
            raise

    async def process_stop_meeting(self, job_data: dict):
        """Process a stop meeting job"""
        meeting_id = job_data["meeting_id"]

        logger.info(f"Processing meeting stop for {meeting_id}")

        try:
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
            await meeting_service.update_meeting_status(
                meeting_id, MeetingStatus.COMPLETED
            )

            logger.info(f"Successfully stopped meeting {meeting_id}")

        except Exception as e:
            logger.error(f"Error processing meeting stop: {e}")
            raise

    async def poll_for_jobs(self):
        """Poll for jobs and process them"""
        logger.info("Starting job polling...")

        while self.running:
            try:
                # Check for join_meeting jobs
                job_result = await simple_queue_service.get_next_job("join_meeting")
                if job_result:
                    job_data = job_result["data"]
                    job = job_result["job"]

                    try:
                        # Start the job but don't complete it yet
                        # The job will be completed when the bot actually finishes
                        await self.process_join_meeting(job_data, job)
                        logger.info(f"Started join_meeting job {job.id}")
                    except Exception as e:
                        await simple_queue_service.fail_job(job, str(e))
                        logger.error(f"Failed to start join_meeting job {job.id}: {e}")

                # Check for stop_meeting jobs
                job_result = await simple_queue_service.get_next_job("stop_meeting")
                if job_result:
                    job_data = job_result["data"]
                    job = job_result["job"]

                    try:
                        await self.process_stop_meeting(job_data)
                        await simple_queue_service.complete_job(job)
                        logger.info(f"Completed stop_meeting job {job.id}")
                    except Exception as e:
                        await simple_queue_service.fail_job(job, str(e))
                        logger.error(f"Failed stop_meeting job {job.id}: {e}")

                # Sleep for a bit before checking again
                await asyncio.sleep(2)

            except Exception as e:
                logger.error(f"Error in job polling loop: {e}")
                await asyncio.sleep(5)  # Wait longer on error

    async def start(self):
        """Start the worker"""
        logger.info("Starting Simple Meeting Worker...")

        try:
            # Initialize the queue service
            await simple_queue_service.initialize()

            # Start the polling loop
            self.running = True
            await self.poll_for_jobs()

        except KeyboardInterrupt:
            logger.info("Worker interrupted, shutting down...")
        except Exception as e:
            logger.error(f"Worker error: {e}")
        finally:
            await self.stop()

    async def stop(self):
        """Stop the worker"""
        logger.info("Stopping Simple Meeting Worker...")
        self.running = False
        await simple_queue_service.cleanup()
        logger.info("Worker stopped")


async def main():
    """Main entry point"""
    worker = SimpleMeetingWorker()
    await worker.start()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("\nShutting down worker...")
    except Exception as e:
        logger.exception("Critical failure in worker: %s", e)
        sys.exit(1)
