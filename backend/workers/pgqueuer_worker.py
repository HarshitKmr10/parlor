#!/usr/bin/env python3
"""
PGQueuer Worker for Meeting Joiner
Runs the PGQueuer consumer to process meeting jobs
"""

import asyncio
import logging
import signal
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parent.parent))

from src.services.pgqueuer_queue_service import pgqueuer_queue_service
from src.services.meeting_cleanup_service import meeting_cleanup_service

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


class PgQueuerWorker:
    """PGQueuer worker for processing meeting jobs"""

    def __init__(self):
        self.running = False
        self.queue_service = pgqueuer_queue_service
        # self.poller_service = meeting_poller_service  # REMOVED - causes duplicate bots
        self.cleanup_service = meeting_cleanup_service
        self.shutdown_event = asyncio.Event()

    async def start(self):
        """Start the worker and cleanup service"""
        self.running = True
        logger.info("🚀 Starting PGQueuer Meeting Worker...")
        logger.info("Press Ctrl+C to stop the worker")

        try:
            # Initialize the queue service
            await self.queue_service.initialize()
            logger.info("✅ Queue service initialized")

            # NOTE: Removed meeting poller to prevent duplicate bot creation
            # The PGQueuer consumer handles all job processing automatically
            # The poller was creating duplicate jobs for meetings already queued via API

            # Start the meeting cleanup service
            logger.info("🧹 Starting meeting cleanup service...")
            cleanup_task = asyncio.create_task(self.cleanup_service.start_cleanup())
            logger.info("✅ Meeting cleanup service started")

            # Start the consumer in a task so we can cancel it
            consumer_task = asyncio.create_task(self.run_consumer())

            # Wait for shutdown signal
            await self.shutdown_event.wait()

            # Cancel all tasks
            logger.info("🛑 Shutting down worker and cleanup service...")

            # Stop services in order
            await self.cleanup_service.stop_cleanup()

            # Cancel remaining tasks
            consumer_task.cancel()
            cleanup_task.cancel()

            try:
                await asyncio.wait_for(
                    asyncio.gather(consumer_task, cleanup_task, return_exceptions=True),
                    timeout=15.0,
                )
            except asyncio.TimeoutError:
                logger.warning("Tasks didn't stop within timeout")
            except asyncio.CancelledError:
                logger.info("✅ All tasks stopped")

        except asyncio.CancelledError:
            logger.info("Worker cancelled")
        except Exception as e:
            logger.error(f"Worker error: {e}")
            raise
        finally:
            await self.cleanup()

    async def run_consumer(self):
        """Run the consumer with periodic checks"""
        try:
            logger.info("🔄 Starting job consumer...")
            # Start the consumer (this will block until cancelled)
            await self.queue_service.start_consumer()
        except asyncio.CancelledError:
            logger.info("Consumer task cancelled")
            raise
        except Exception as e:
            logger.error(f"Consumer error: {e}")
            raise

    async def stop(self):
        """Stop the worker"""
        logger.info("🛑 Stopping PGQueuer Meeting Worker...")
        self.running = False
        self.shutdown_event.set()

    async def cleanup(self):
        """Cleanup resources"""
        logger.info("🧹 Cleaning up worker...")
        try:
            await self.queue_service.cleanup()
            logger.info("✅ Cleanup completed")
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")

    async def get_status(self):
        """Get worker status"""
        queue_stats = await self.queue_service.get_queue_stats()
        cleanup_stats = self.cleanup_service.get_stats()

        return {
            "worker_running": self.running,
            "queue": queue_stats,
            "cleanup": cleanup_stats,
        }


async def setup_signal_handlers(worker):
    """Set up asyncio-compatible signal handlers"""
    loop = asyncio.get_running_loop()

    def signal_handler():
        logger.info("📡 Received shutdown signal, stopping worker...")
        asyncio.create_task(worker.stop())

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, signal_handler)
            logger.debug(f"Registered signal handler for {sig}")
        except NotImplementedError:
            # Windows doesn't support add_signal_handler
            logger.debug(f"Signal handler for {sig} not supported on this platform")


async def main():
    """Main function"""
    worker = PgQueuerWorker()

    try:
        await setup_signal_handlers(worker)

        await worker.start()

    except KeyboardInterrupt:
        logger.info("📡 Received keyboard interrupt")
        await worker.stop()
    except Exception as e:
        logger.error(f"❌ Worker failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n🛑 Worker interrupted by user")
    except Exception as e:
        logger.exception("💥 Critical failure encountered: %s", e)
        sys.exit(1)
    finally:
        print("�� Worker stopped")
