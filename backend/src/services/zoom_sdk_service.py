"""
Zoom SDK Service
Manages Zoom SDK bot processes for joining and transcribing Zoom meetings
"""

import asyncio
import json
import logging
import multiprocessing
import subprocess
import os
import re
from typing import Dict, Optional
from urllib.parse import parse_qs, urlparse

logger = logging.getLogger(__name__)


class ZoomSDKService:
    """Service for managing Zoom SDK bot processes"""

    def __init__(self):
        self.active_processes: Dict[str, multiprocessing.Process] = {}
        # Set multiprocessing start method to 'spawn' for better isolation
        try:
            multiprocessing.set_start_method('spawn', force=False)
        except RuntimeError:
            # Already set, ignore
            pass

    @staticmethod
    def parse_zoom_url(meeting_url: str) -> Optional[Dict[str, str]]:
        """
        Parse Zoom meeting URL to extract meeting ID and password
        
        Args:
            meeting_url: Zoom meeting URL
            
        Returns:
            Dictionary with meeting_id and password, or None if parsing fails
        """
        try:
            # Handle different Zoom URL formats:
            # 1. https://zoom.us/j/1234567890?pwd=abcdef
            # 2. https://us02web.zoom.us/j/1234567890?pwd=abcdef
            # 3. https://zoom.us/wc/join/1234567890
            
            parsed = urlparse(meeting_url)
            
            # Extract meeting ID from path
            meeting_id = None
            path_parts = parsed.path.split('/')
            
            # Look for numeric meeting ID in path
            for part in path_parts:
                if part.isdigit() and len(part) >= 9:  # Zoom meeting IDs are typically 9-11 digits
                    meeting_id = part
                    break
            
            if not meeting_id:
                logger.error(f"Could not extract meeting ID from URL: {meeting_url}")
                return None
            
            # Extract password from query parameters
            query_params = parse_qs(parsed.query)
            password = query_params.get('pwd', [''])[0]
            
            # Some URLs have the password in 'password' param
            if not password:
                password = query_params.get('password', [''])[0]
            
            logger.info(f"Parsed Zoom URL - Meeting ID: {meeting_id}, Has Password: {bool(password)}")
            
            return {
                'meeting_id': meeting_id,
                'password': password
            }
            
        except Exception as e:
            logger.error(f"Error parsing Zoom URL: {e}")
            return None

    async def join_meeting(self,
                          meeting_db_id: str,
                          meeting_url: str,
                          bot_name: str = "Transcription Bot") -> bool:
        """
        Join a Zoom meeting using the SDK bot

        Args:
            meeting_db_id: Database ID for the meeting
            meeting_url: Zoom meeting URL
            bot_name: Display name for the bot

        Returns:
            True if bot process started successfully, False otherwise
        """
        try:
            # Check if Zoom SDK dependencies are available
            try:
                from ..bot.zoom_sdk_bot.zoom_bot_runner import ZOOM_SDK_AVAILABLE
                if not ZOOM_SDK_AVAILABLE:
                    logger.error("Cannot join Zoom meeting - pygobject and GLib dependencies not available")
                    logger.error("Install pygobject to enable Zoom SDK functionality")
                    return False
            except ImportError:
                logger.error("Cannot join Zoom meeting - Zoom SDK bot runner not available")
                logger.error("Install pygobject to enable Zoom SDK functionality")
                return False
            # Parse meeting URL
            meeting_info = self.parse_zoom_url(meeting_url)
            if not meeting_info:
                logger.error(f"Failed to parse Zoom URL: {meeting_url}")
                return False
            
            meeting_id = meeting_info['meeting_id']
            meeting_password = meeting_info['password']
            
            # Check if credentials are available (support both naming conventions)
            client_id = os.environ.get('ZOOM_APP_CLIENT_ID') or os.environ.get('ZOOM_CLIENT_ID')
            client_secret = os.environ.get('ZOOM_APP_CLIENT_SECRET') or os.environ.get('ZOOM_CLIENT_SECRET')
            
            if not client_id or not client_secret:
                logger.error("ZOOM_CLIENT_ID and ZOOM_CLIENT_SECRET must be set in environment")
                return False
            
            # Create transcript file path
            transcript_file = f"/tmp/zoom_transcript_{meeting_db_id}.json"
            
            # Start the bot in a separate process
            logger.info(f"Starting Zoom SDK bot process for meeting {meeting_id}")
            
            process = multiprocessing.Process(
                target=self._run_bot_process,
                args=(meeting_url, meeting_id, meeting_password, bot_name, meeting_db_id, transcript_file),
                name=f"zoom-bot-{meeting_db_id}"
            )
            
            process.start()
            
            # Store process reference
            self.active_processes[meeting_db_id] = process

            # Also store PID in a file for persistence across container restarts
            try:
                pid_file = f"/tmp/zoom_bot_pid_{meeting_db_id}.txt"
                with open(pid_file, 'w') as f:
                    f.write(str(process.pid))
                logger.info(f"Stored PID {process.pid} in {pid_file}")
            except Exception as e:
                logger.warning(f"Failed to store PID in file: {e}")

            logger.info(f"Zoom SDK bot process started with PID {process.pid}")
            
            # Wait a bit to check if process started successfully
            await asyncio.sleep(2)
            
            if not process.is_alive():
                logger.error("Zoom SDK bot process died immediately after starting")
                return False
            
            return True
            
        except Exception as e:
            logger.error(f"Error starting Zoom SDK bot: {e}", exc_info=True)
            return False

    @staticmethod
    def _run_bot_process(meeting_url: str,
                        meeting_id: str,
                        meeting_password: str,
                        bot_name: str,
                        meeting_db_id: str,
                        transcript_file: str):
        """
        Run the bot process (called in separate process)
        
        Args:
            meeting_url: Full meeting URL
            meeting_id: Zoom meeting ID
            meeting_password: Meeting password
            bot_name: Display name for the bot
            meeting_db_id: Database ID for the meeting
            transcript_file: Path to save transcript JSON
        """
        # Configure logging for the subprocess
        logging.basicConfig(
            level=logging.INFO,
            format=f"[Zoom Bot {meeting_db_id}] %(asctime)s - %(name)s - %(levelname)s - %(message)s"
        )
        
        try:
            # Store PID in worker container for this meeting
            import os
            pid_file = f"/tmp/zoom_bot_pid_{meeting_db_id}.txt"
            try:
                with open(pid_file, 'w') as f:
                    f.write(str(os.getpid()))
                logger.info(f"Stored worker PID {os.getpid()} in {pid_file}")
            except Exception as e:
                logger.warning(f"Failed to store PID in worker container: {e}")

            # Import here to avoid issues with multiprocessing
            try:
                from ..bot.zoom_sdk_bot.zoom_bot_runner import run_zoom_bot, ZOOM_SDK_AVAILABLE

                if not ZOOM_SDK_AVAILABLE:
                    logger.error("Cannot start Zoom bot - pygobject and GLib dependencies not available")
                    logger.error("Install pygobject to enable Zoom SDK functionality")
                    return
            except ImportError as e:
                logger.error(f"Cannot import Zoom SDK bot runner: {e}")
                logger.error("Install pygobject to enable Zoom SDK functionality")
                return

            # Run the bot
            run_zoom_bot(
                meeting_url=meeting_url,
                meeting_id=meeting_id,
                meeting_password=meeting_password,
                bot_name=bot_name,
                meeting_db_id=meeting_db_id,
                transcript_file=transcript_file
            )
            
        except Exception as e:
            logger.error(f"Error in bot process: {e}", exc_info=True)
            raise

    async def leave_meeting(self, meeting_db_id: str) -> bool:
        """
        Leave a Zoom meeting (terminate the bot process)

        Args:
            meeting_db_id: Database ID for the meeting

        Returns:
            True if process was terminated successfully, False otherwise
        """
        try:
            process = self.active_processes.get(meeting_db_id)

            if not process:
                logger.warning(f"No tracked process found for meeting {meeting_db_id}, searching for orphaned processes...")
                # Search for orphaned Zoom bot processes
                success = await self._terminate_orphaned_zoom_processes(meeting_db_id)
                if success:
                    logger.info(f"Successfully terminated orphaned Zoom bot process for meeting {meeting_db_id}")
                    return True
                else:
                    logger.warning(f"No orphaned Zoom bot processes found for meeting {meeting_db_id}")
                    return False

            if not process.is_alive():
                logger.info(f"Process for meeting {meeting_db_id} is already dead")
                del self.active_processes[meeting_db_id]
                return True

            logger.info(f"Terminating tracked Zoom SDK bot process for meeting {meeting_db_id}")

            # Try graceful termination first
            process.terminate()

            # Wait up to 5 seconds for graceful shutdown
            process.join(timeout=5)

            # If still alive, force kill
            if process.is_alive():
                logger.warning(f"Process for meeting {meeting_db_id} didn't terminate gracefully, killing...")
                process.kill()
                process.join(timeout=2)

            # Remove from active processes
            del self.active_processes[meeting_db_id]

            logger.info(f"Successfully terminated tracked Zoom SDK bot for meeting {meeting_db_id}")
            return True

        except Exception as e:
            logger.error(f"Error leaving meeting {meeting_db_id}: {e}")
            return False

    async def _terminate_orphaned_zoom_processes(self, meeting_db_id: str) -> bool:
        """
        Find and terminate orphaned Zoom bot processes after container restarts

        Args:
            meeting_db_id: Database ID for the meeting

        Returns:
            True if orphaned processes were found and terminated
        """
        try:
            # First, try to get the stored PID from worker container
            stored_pid = await self._get_stored_pid_from_worker(meeting_db_id)

            # Create a termination signal file for the worker to check
            terminated_signaled = await self._signal_termination(meeting_db_id, stored_pid)
            if terminated_signaled:
                return True

            import psutil
            import signal

            terminated_any = False

            # Look for zoom bot processes in current container using stored PID
            if stored_pid:
                try:
                    if psutil.pid_exists(stored_pid):
                        proc = psutil.Process(stored_pid)
                        logger.info(f"Found stored PID {stored_pid}, terminating...")

                        # Send SIGTERM first (Ctrl+C equivalent)
                        os.kill(stored_pid, signal.SIGTERM)
                        logger.info(f"Sent SIGTERM to PID {stored_pid}")

                        # Wait for graceful shutdown
                        await asyncio.sleep(3)

                        # Check if still alive and force kill
                        if psutil.pid_exists(stored_pid):
                            os.kill(stored_pid, signal.SIGKILL)
                            logger.info(f"Sent SIGKILL to PID {stored_pid}")

                        terminated_any = True

                        # Clean up PID file
                        if os.path.exists(pid_file):
                            os.remove(pid_file)

                except (psutil.NoSuchProcess, ProcessLookupError):
                    logger.info(f"Stored PID {stored_pid} no longer exists")
                    # Clean up stale PID file
                    if os.path.exists(pid_file):
                        os.remove(pid_file)

            return terminated_any

        except ImportError:
            # Fallback method using /proc filesystem
            logger.warning("psutil not available, using fallback method")
            return await self._terminate_orphaned_zoom_processes_fallback(meeting_db_id)
        except Exception as e:
            logger.error(f"Error terminating orphaned processes: {e}")
            return False

    async def _get_stored_pid_from_worker(self, meeting_db_id: str) -> Optional[int]:
        """
        Get the stored PID from the worker container

        Args:
            meeting_db_id: Database ID for the meeting

        Returns:
            The stored PID if found, None otherwise
        """
        try:
            import subprocess

            container_name = "meeting-joiner-worker"
            pid_file = f"/tmp/zoom_bot_pid_{meeting_db_id}.txt"

            # Try to read PID file from worker container
            cat_cmd = ["docker", "exec", container_name, "cat", pid_file]
            result = subprocess.run(cat_cmd, capture_output=True, text=True)

            if result.returncode == 0:
                stored_pid = int(result.stdout.strip())
                logger.info(f"Found stored PID {stored_pid} for meeting {meeting_db_id} in worker container")
                return stored_pid
            else:
                logger.info(f"No stored PID file found for meeting {meeting_db_id} in worker container")
                return None

        except Exception as e:
            logger.warning(f"Failed to get stored PID from worker container: {e}")
            return None

    async def _cleanup_pid_file_in_worker(self, meeting_db_id: str):
        """
        Clean up the PID file in the worker container

        Args:
            meeting_db_id: Database ID for the meeting
        """
        try:
            import subprocess

            container_name = "meeting-joiner-worker"
            pid_file = f"/tmp/zoom_bot_pid_{meeting_db_id}.txt"

            # Remove PID file from worker container
            rm_cmd = ["docker", "exec", container_name, "rm", "-f", pid_file]
            subprocess.run(rm_cmd, capture_output=True, text=True)
            logger.info(f"Cleaned up PID file {pid_file} in worker container")

        except Exception as e:
            logger.warning(f"Failed to cleanup PID file in worker container: {e}")

    async def _signal_termination(self, meeting_db_id: str, stored_pid: Optional[int] = None) -> bool:
        """
        Signal termination by creating a termination signal file

        Args:
            meeting_db_id: Database ID for the meeting
            stored_pid: The stored PID if available (for verification)

        Returns:
            True if signal was sent successfully
        """
        try:
            # Create termination signal file in shared volume directory
            signal_file = f"/tmp/zoom_transcripts/zoom_bot_terminate_{meeting_db_id}.txt"

            with open(signal_file, 'w') as f:
                f.write(f"terminate\npid:{stored_pid}\ntime:{asyncio.get_event_loop().time()}")

            logger.info(f"Created termination signal file {signal_file} for meeting {meeting_db_id}")

            # Wait a reasonable time for the worker process to pick up the signal and terminate
            await asyncio.sleep(5)

            # Check if signal was processed (file should be removed by worker)
            if not os.path.exists(signal_file):
                logger.info(f"Termination signal was processed for meeting {meeting_db_id}")
                return True
            else:
                logger.warning(f"Termination signal was not processed for meeting {meeting_db_id}")
                # Clean up signal file
                try:
                    os.remove(signal_file)
                except:
                    pass
                return False

        except Exception as e:
            logger.error(f"Error signaling termination: {e}")
            return False

    async def _terminate_zoom_process_docker(self, meeting_db_id: str, stored_pid: Optional[int] = None) -> bool:
        """
        Terminate Zoom bot process in worker container using docker exec

        Args:
            meeting_db_id: Database ID for the meeting
            stored_pid: The stored PID if available

        Returns:
            True if process was terminated successfully
        """
        try:
            import subprocess

            container_name = "meeting-joiner-worker"

            if stored_pid:
                # Try to kill the specific PID
                logger.info(f"Attempting to kill specific PID {stored_pid} in worker container")

                # Check if PID exists in worker container
                check_cmd = ["docker", "exec", container_name, "kill", "-0", str(stored_pid)]
                result = subprocess.run(check_cmd, capture_output=True, text=True)

                if result.returncode == 0:
                    # PID exists, send SIGTERM
                    term_cmd = ["docker", "exec", container_name, "kill", "-15", str(stored_pid)]
                    subprocess.run(term_cmd, capture_output=True, text=True)
                    logger.info(f"Sent SIGTERM to PID {stored_pid} in worker container")

                    # Wait a bit, then send SIGKILL if still alive
                    await asyncio.sleep(3)

                    kill_cmd = ["docker", "exec", container_name, "kill", "-9", str(stored_pid)]
                    subprocess.run(kill_cmd, capture_output=True, text=True)
                    logger.info(f"Sent SIGKILL to PID {stored_pid} in worker container")

                    return True
                else:
                    logger.info(f"PID {stored_pid} not found in worker container")

            # Fallback: find and kill multiprocessing spawn processes
            logger.info("Searching for multiprocessing spawn processes in worker container")

            # Get process list from worker container
            ps_cmd = ["docker", "exec", container_name, "ps", "aux"]
            result = subprocess.run(ps_cmd, capture_output=True, text=True)

            if result.returncode != 0:
                logger.warning("Failed to get process list from worker container")
                return False

            terminated_any = False
            for line in result.stdout.split('\n'):
                if 'multiprocessing.spawn' in line and 'python' in line:
                    parts = line.split()
                    if len(parts) >= 2:
                        pid = parts[1]
                        logger.info(f"Found potential zoom bot process PID {pid} in worker container")

                        # Send SIGTERM
                        term_cmd = ["docker", "exec", container_name, "kill", "-15", pid]
                        subprocess.run(term_cmd, capture_output=True, text=True)
                        logger.info(f"Sent SIGTERM to PID {pid} in worker container")

                        terminated_any = True

            if terminated_any:
                # Wait a bit, then send SIGKILL to any remaining processes
                await asyncio.sleep(3)

                result = subprocess.run(ps_cmd, capture_output=True, text=True)
                for line in result.stdout.split('\n'):
                    if 'multiprocessing.spawn' in line and 'python' in line:
                        parts = line.split()
                        if len(parts) >= 2:
                            pid = parts[1]
                            kill_cmd = ["docker", "exec", container_name, "kill", "-9", pid]
                            subprocess.run(kill_cmd, capture_output=True, text=True)
                            logger.info(f"Sent SIGKILL to PID {pid} in worker container")

            return terminated_any

        except Exception as e:
            logger.error(f"Error terminating zoom process via docker: {e}")
            return False

    async def _terminate_orphaned_zoom_processes_fallback(self, meeting_db_id: str) -> bool:
        """
        Fallback method using /proc filesystem to find and terminate zoom processes
        """
        try:
            import glob

            terminated_any = False

            # Look through all processes in /proc
            for proc_dir in glob.glob("/proc/[0-9]*"):
                try:
                    pid = os.path.basename(proc_dir)
                    cmdline_path = os.path.join(proc_dir, "cmdline")

                    # Read process command line
                    if os.path.exists(cmdline_path):
                        try:
                            with open(cmdline_path, 'r') as f:
                                cmdline = f.read().replace('\x00', ' ')

                            # Look for Python multiprocessing spawn processes (zoom bots)
                            if ('python' in cmdline.lower() and
                                ('multiprocessing.spawn' in cmdline or 'zoom' in cmdline.lower())):

                                logger.info(f"Found potential zoom bot process PID {pid}: {cmdline[:100]}...")

                                try:
                                    pid_int = int(pid)

                                    # Send SIGTERM (Ctrl+C equivalent)
                                    os.kill(pid_int, 15)  # SIGTERM = 15
                                    logger.info(f"Sent SIGTERM to PID {pid}")

                                    # Wait for graceful shutdown
                                    await asyncio.sleep(3)

                                    # Check if still alive and force kill
                                    try:
                                        os.kill(pid_int, 0)  # Check if process exists (signal 0)
                                        os.kill(pid_int, 9)  # SIGKILL = 9
                                        logger.info(f"Sent SIGKILL to PID {pid}")
                                    except ProcessLookupError:
                                        # Process already dead
                                        logger.info(f"Process {pid} terminated gracefully")
                                        pass

                                    terminated_any = True

                                except (ProcessLookupError, PermissionError, ValueError) as e:
                                    logger.warning(f"Failed to kill process {pid}: {e}")

                        except (IOError, OSError):
                            # Process may have disappeared or we don't have permission
                            continue

                except (ValueError, OSError):
                    # Invalid PID directory
                    continue

            if terminated_any:
                logger.info("Successfully terminated zoom bot processes using /proc filesystem")
            else:
                logger.info("No zoom bot processes found in /proc filesystem")

            return terminated_any

        except Exception as e:
            logger.error(f"Error in fallback termination: {e}")
            return False

    async def get_transcripts(self, meeting_db_id: str) -> Optional[list]:
        """
        Get transcripts for a meeting
        
        Args:
            meeting_db_id: Database ID for the meeting
            
        Returns:
            List of transcript entries, or None if not available
        """
        transcript_file = f"/tmp/zoom_transcript_{meeting_db_id}.json"
        
        try:
            if os.path.exists(transcript_file):
                with open(transcript_file, 'r') as f:
                    transcripts = json.load(f)
                return transcripts
        except Exception as e:
            logger.error(f"Error reading transcripts for meeting {meeting_db_id}: {e}")
        
        return None

    async def update_meeting_transcripts(self, meeting_db_id: str) -> bool:
        """
        Legacy method - Enhanced transcriber now handles database storage automatically

        Args:
            meeting_db_id: Database ID for the meeting

        Returns:
            True (enhanced transcriber handles this automatically)
        """
        logger.info(f"Enhanced transcriber handles automatic database storage for meeting {meeting_db_id}")
        return True

    def cleanup(self):
        """Clean up all active processes"""
        logger.info(f"Cleaning up {len(self.active_processes)} active Zoom SDK bot processes")
        
        for meeting_id, process in list(self.active_processes.items()):
            try:
                if process.is_alive():
                    process.terminate()
                    process.join(timeout=3)
                    if process.is_alive():
                        process.kill()
            except Exception as e:
                logger.error(f"Error cleaning up process for meeting {meeting_id}: {e}")
        
        self.active_processes.clear()


# Global instance
zoom_sdk_service = ZoomSDKService()
