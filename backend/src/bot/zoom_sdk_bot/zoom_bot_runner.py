"""
Zoom Bot Runner
Handles running the Zoom SDK bot in a separate process with proper lifecycle management
"""

import logging
import os
import signal
import sys
from typing import Optional

# Initialize logger first before any imports that might need it
logger = logging.getLogger(__name__)

# Optional imports - only required for Zoom SDK functionality
try:
    import gi
    gi.require_version('GLib', '2.0')
    from gi.repository import GLib
    ZOOM_SDK_AVAILABLE = True
except ImportError as e:
    ZOOM_SDK_AVAILABLE = False
    logger.warning(f"Zoom SDK dependencies not available: {e}")
    logger.warning("Install pygobject to enable Zoom SDK bot functionality")

from .zoom_bot_simple import SimpleZoomBot


class ZoomBotRunner:
    """Runner for Zoom SDK bot with GLib main loop"""

    def __init__(self, 
                 client_id: str,
                 client_secret: str,
                 meeting_id: str,
                 meeting_password: str,
                 bot_name: str = "Transcription Bot",
                 openai_api_key: Optional[str] = None,
                 transcript_file: Optional[str] = None,
                 meeting_db_id: Optional[str] = None):
        """
        Initialize the bot runner
        
        Args:
            client_id: Zoom app client ID
            client_secret: Zoom app client secret
            meeting_id: Zoom meeting ID to join
            meeting_password: Meeting password
            bot_name: Display name for the bot
            openai_api_key: OpenAI API key for transcription
            transcript_file: Path to save transcript JSON
            meeting_db_id: Database ID for the meeting (for status updates)
        """
        self.bot = None
        self.main_loop = None
        self.shutdown_requested = False
        self.meeting_db_id = meeting_db_id
        
        # Bot configuration
        self.client_id = client_id
        self.client_secret = client_secret
        self.meeting_id = meeting_id
        self.meeting_password = meeting_password
        self.bot_name = bot_name
        self.openai_api_key = openai_api_key
        self.transcript_file = transcript_file

    def exit_process(self, status: int = 0):
        """Clean shutdown of the bot and main loop.

        ``status`` is the process exit code to report once cleanup finishes
        (or fails). Defaults to 0 so signal/timeout-triggered shutdowns keep
        exiting clean; callers that know the shutdown followed a failure
        (e.g. SDK init) should pass the appropriate non-zero code.
        """
        logger.info("Starting cleanup process...")

        if self.shutdown_requested:
            return False
        self.shutdown_requested = True

        try:
            if self.bot:
                logger.info("Leaving meeting...")
                self.bot.leave()
                logger.info("Cleaning up bot...")
                self.bot.cleanup()

            # Get final transcripts
            if self.bot and self.bot.transcriber:
                transcripts = self.bot.get_transcripts()
                logger.info(f"Collected {len(transcripts)} transcript entries")

            self.force_exit(status)

        except Exception as e:
            logger.error(f"Error during cleanup: {e}")
            self.force_exit(status if status != 0 else 1)

        return False

    def force_exit(self, status: int = 0):
        """Force the process to exit with the given status code.

        The supervisor (``bot_supervisor.py`` / ``local_bot_runner.py``)
        treats only a 0 exit code as success, so failure paths must pass a
        non-zero ``status`` or the caller misreads a crash as a clean exit.
        """
        logger.info(f"Zoom bot runner shutting down (status={status})")
        if self.main_loop and self.main_loop.is_running():
            self.main_loop.quit()
        os._exit(status)

    def on_signal(self, signum, frame):
        """Signal handler for SIGINT and SIGTERM"""
        logger.info(f"Received signal {signum}")
        if self.main_loop:
            GLib.timeout_add(100, self.exit_process)
        else:
            self.exit_process()

    def on_timeout(self):
        """Regular timeout callback"""
        if self.shutdown_requested:
            return False

        # Check for termination signal file
        self.check_termination_signal()

        return True

    def _record_exit_reason(self, exit_reason: str, exit_details: dict | None = None) -> None:
        """Best-effort write of exit_reason/exit_details on the meeting_joiner
        row. Called from the shutdown path so the DB carries the reason even
        when the worker-side status flip happens later. Failures are swallowed
        because we never want to block tear-down on DB IO."""
        try:
            import asyncio
            import json
            import asyncpg
            from src.db.python.dsn import normalize_postgres_dsn
            from src.db.python.schema import qualified_name

            database_url = os.environ.get('DATABASE_URL') or os.environ.get('DIRECT_URL')
            if not database_url or not self.meeting_db_id:
                return

            payload = json.dumps(exit_details or {})
            meeting_table = qualified_name("meeting_joiner")

            async def _write() -> None:
                conn = await asyncpg.connect(normalize_postgres_dsn(database_url))
                try:
                    await conn.execute(
                        f"""
                        UPDATE {meeting_table}
                           SET exit_reason = $2,
                               exit_details = $3::jsonb,
                               updated_at = NOW()
                         WHERE id = $1
                        """,
                        self.meeting_db_id,
                        exit_reason[:64],
                        payload,
                    )
                finally:
                    await conn.close()

            asyncio.run(_write())
            logger.info(f"Recorded exit_reason={exit_reason} for meeting {self.meeting_db_id}")
        except Exception as err:
            logger.debug(f"_record_exit_reason swallowed error: {err}")

    def check_database_stop_status(self):
        """
        Check if meeting status changed to 'completed' in database (external stop signal).
        This enables cross-pod termination for Zoom meetings.
        """
        try:
            import asyncio
            import asyncpg
            from src.db.python.dsn import normalize_postgres_dsn
            from src.db.python.schema import qualified_name

            # Get database URL from environment
            database_url = os.environ.get('DATABASE_URL') or os.environ.get('DIRECT_URL')
            if not database_url:
                return False
            meeting_table = qualified_name("meeting_joiner")

            async def _check_status():
                conn = await asyncpg.connect(normalize_postgres_dsn(database_url))
                try:
                    result = await conn.fetchval(
                        f"SELECT status FROM {meeting_table} WHERE id = $1",
                        self.meeting_db_id
                    )
                    return result
                finally:
                    await conn.close()

            status = asyncio.run(_check_status())

            if status == 'completed':
                logger.info(f"🛑 External stop detected in database for meeting {self.meeting_db_id}")
                return True

            return False

        except Exception as e:
            # Don't log on every check, only real errors
            if "does not exist" not in str(e) and "could not connect" not in str(e):
                logger.debug(f"Database check error (non-critical): {e}")
            return False

    def check_termination_signal(self):
        """Check for termination signals (file-based or database status) and shut down if found"""
        should_terminate = False
        termination_reason = None
        
        try:
            # Check 1: File-based termination signal (legacy)
            signal_file = f"/tmp/zoom_transcripts/zoom_bot_terminate_{self.meeting_db_id}.txt"
            if os.path.exists(signal_file):
                logger.info(f"File-based termination signal detected for meeting {self.meeting_db_id}")
                
                # Read and validate the signal file
                try:
                    with open(signal_file, 'r') as f:
                        content = f.read()
                    
                    if "terminate" in content:
                        should_terminate = True
                        termination_reason = "file_signal"
                        
                        # Remove the signal file to indicate it was processed
                        try:
                            os.remove(signal_file)
                            logger.info(f"Removed termination signal file {signal_file}")
                        except:
                            pass
                except Exception as e:
                    logger.warning(f"Failed to process termination signal file: {e}")
            
            # Check 2: Database status check (cross-pod termination)
            if not should_terminate and self.check_database_stop_status():
                should_terminate = True
                termination_reason = "database_status_completed"
            
            # If termination signal detected, shut down
            if should_terminate:
                logger.info(f"Valid termination signal received ({termination_reason}), shutting down bot...")

                # Persist exit reason before tearing down so the row carries
                # the "why" even if the orchestrator's later status flip wins
                # the race. Best-effort — never blocks shutdown.
                try:
                    self._record_exit_reason(
                        "external_stop" if termination_reason == "database_status_completed" else "file_signal",
                        {"source": termination_reason},
                    )
                except Exception as exit_err:
                    logger.debug(f"record_exit_reason failed: {exit_err}")

                # Clean up PID file
                try:
                    pid_file = f"/tmp/zoom_bot_pid_{self.meeting_db_id}.txt"
                    if os.path.exists(pid_file):
                        os.remove(pid_file)
                        logger.info(f"Cleaned up PID file {pid_file}")
                except:
                    pass
                
                # Trigger shutdown
                self.shutdown_requested = True
                if self.main_loop:
                    GLib.timeout_add(100, self.exit_process)
                
                # As a backup, also schedule a force exit in case cleanup gets stuck
                GLib.timeout_add(3000, self.force_exit_fallback)  # 3 seconds
                return

        except Exception as e:
            # Don't log every timeout, only errors
            if "No such file or directory" not in str(e):
                logger.warning(f"Error checking termination signal: {e}")

    def force_exit_fallback(self):
        """Force exit fallback in case normal cleanup gets stuck"""
        logger.warning("Force exit fallback triggered - normal cleanup may be stuck")
        self.force_exit()
        return False

    def run(self):
        """Main run method"""
        logger.info("=== Zoom Meeting Bot Runner ===")
        logger.info(f"Meeting ID: {self.meeting_id}")
        logger.info(f"Bot Name: {self.bot_name}")
        
        # Create and initialize bot (using SimpleZoomBot)
        try:
            logger.info("Using SimpleZoomBot")
            self.bot = SimpleZoomBot(
                client_id=self.client_id,
                client_secret=self.client_secret,
                meeting_id=self.meeting_id,
                meeting_password=self.meeting_password,
                bot_name=self.bot_name,
                meeting_db_id=self.meeting_db_id,
                transcript_file=self.transcript_file,
                on_exit_reason=self._record_exit_reason,
            )

            self.bot.init()
        except Exception as e:
            logger.error(f"Failed to initialize bot: {e}")
            self.exit_process(status=2)
            return

        # Create a GLib main loop
        self.main_loop = GLib.MainLoop()

        # Add timeout callback
        GLib.timeout_add(100, self.on_timeout)

        # Set up signal handlers
        signal.signal(signal.SIGINT, self.on_signal)
        signal.signal(signal.SIGTERM, self.on_signal)

        exit_status = 0
        try:
            logger.info("Starting bot main loop...")
            self.main_loop.run()
        except KeyboardInterrupt:
            logger.info("Interrupted by user, shutting down...")
        except Exception as e:
            logger.error(f"Error in main loop: {e}")
            exit_status = 1
        finally:
            self.exit_process(status=exit_status)


def run_zoom_bot(meeting_url: str,
                 meeting_id: str,
                 meeting_password: str,
                 bot_name: str,
                 meeting_db_id: Optional[str] = None,
                 transcript_file: Optional[str] = None):
    """
    Run the Zoom SDK bot (entry point for multiprocessing)
    
    Args:
        meeting_url: Full meeting URL (for logging)
        meeting_id: Zoom meeting ID
        meeting_password: Meeting password
        bot_name: Display name for the bot
        meeting_db_id: Database ID for the meeting
        transcript_file: Path to save transcript JSON
    """
    # Get credentials from environment
    # Support both naming conventions for Zoom credentials
    client_id = os.environ.get('ZOOM_APP_CLIENT_ID') or os.environ.get('ZOOM_CLIENT_ID')
    client_secret = os.environ.get('ZOOM_APP_CLIENT_SECRET') or os.environ.get('ZOOM_CLIENT_SECRET')
    openai_api_key = os.environ.get('OPENAI_API_KEY')
    
    if not client_id or not client_secret:
        logger.error("ZOOM_CLIENT_ID and ZOOM_CLIENT_SECRET must be set in environment")
        sys.exit(1)
    
    # Create and run the bot
    runner = ZoomBotRunner(
        client_id=client_id,
        client_secret=client_secret,
        meeting_id=meeting_id,
        meeting_password=meeting_password,
        bot_name=bot_name,
        openai_api_key=openai_api_key,
        transcript_file=transcript_file,
        meeting_db_id=meeting_db_id
    )
    
    runner.run()


if __name__ == "__main__":
    # For testing
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )
    
    # Get from command line or environment. ZOOM_MEETING_NUMBER/ZOOM_MEETING_PWD
    # are the dedicated vars the supervisor (bot_supervisor.py /
    # local_bot_runner.py) populates by parsing the numeric meeting number +
    # password out of meeting_url — MEETING_ID/MEETING_PWD are kept only as a
    # legacy fallback for manual invocation (MEETING_ID doubles as the
    # meeting_joiner DB row id elsewhere in the stack, so it is NOT a
    # joinable Zoom meeting number when set by the supervisor).
    meeting_id = (
        sys.argv[1] if len(sys.argv) > 1
        else os.environ.get('ZOOM_MEETING_NUMBER') or os.environ.get('MEETING_ID')
    )
    meeting_pwd = (
        sys.argv[2] if len(sys.argv) > 2
        else os.environ.get('ZOOM_MEETING_PWD') or os.environ.get('MEETING_PWD')
    )

    if not meeting_id or not meeting_pwd:
        print("Usage: python zoom_bot_runner.py <meeting_id> <meeting_password>")
        print("Or set ZOOM_MEETING_NUMBER and ZOOM_MEETING_PWD environment variables")
        sys.exit(1)
    
    run_zoom_bot(
        meeting_url=f"https://zoom.us/j/{meeting_id}",
        meeting_id=meeting_id,
        meeting_password=meeting_pwd,
        bot_name="Test Bot"
    )
