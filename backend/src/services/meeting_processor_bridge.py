"""
Meeting Processor Bridge Service
Bridges between PGQueuer (Python) and meetingProcessor.js (Node.js)
Routes Zoom meetings to Zoom SDK bot, Teams and Google Meet to Node.js processor
"""

import asyncio
import json
import logging
import os
import subprocess
import sys
from pathlib import Path
from typing import Dict, Any, Optional
from datetime import datetime, timezone

# Default bot subprocess timeout: 9h. Slightly larger than MSTEAMS_MAX_MEETING_MS
# (8h at joinMeeting.js:42) so the bot exits cleanly with its own exit reason
# rather than being killed by this overall wrapper timeout. Override via env.
_DEFAULT_BOT_SUBPROCESS_TIMEOUT_S = 9 * 60 * 60

from ..api.database.connection import get_db_connection
from ..api.models.schemas import MeetingStatus
from ..services.meeting_service import MeetingService
from ..shared.platformDetector import PlatformDetector

# Initialize logger first
logger = logging.getLogger(__name__)

# Use process-based Zoom SDK service (we're already in a Linux container)
from ..services.zoom_sdk_service import zoom_sdk_service
logger.info("Using process-based Zoom SDK service")


class MeetingProcessorBridge:
    """
    Service that bridges between PGQueuer and the existing Node.js meeting processor
    """

    def __init__(self):
        project_root = Path(__file__).parent.parent.parent  # Go up to meeting-joiner/
        src_dir = project_root / "src"
        self.node_processor_path = src_dir / "processors/meetingProcessor.js"
        self.working_directory = project_root

    async def process_meeting(
        self, meeting_id: str, meeting_url: str, bot_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Process a meeting by routing to the appropriate platform handler
        - Zoom meetings → Zoom SDK Bot (Python)
        - Teams meetings → Node.js processor
        - Google Meet → Node.js processor

        Args:
            meeting_id: UUID of the meeting
            meeting_url: Meeting URL (Teams, Zoom, or Google Meet)
            bot_name: Name for the bot (optional, will fallback to database or default)

        Returns:
            Dictionary with processing results
        """
        logger.info(f"🤖 Starting meeting processing for {meeting_id}")
        logger.info(f"🔗 Meeting URL: {meeting_url}")

        try:
            # Detect platform
            platform = PlatformDetector.detect_platform(meeting_url)
            logger.info(f"🔍 Detected platform: {platform}")

            # Use provided bot_name or get from database as fallback
            if bot_name:
                logger.info(f"🤖 Using provided bot name: {bot_name}")
            else:
                # Fallback to database lookup if bot_name not provided
                db = await get_db_connection()
                meeting_service = MeetingService(db)
                meeting = await meeting_service.get_meeting_by_id(meeting_id)

                if not meeting:
                    raise Exception(f"Meeting {meeting_id} not found in database")

                bot_name = meeting.bot_name or "Meeting Bot"
                logger.info(f"🤖 Using bot name from database: {bot_name}")

            # Update meeting status to ongoing before starting processing
            logger.info(f"📝 Updating meeting {meeting_id} status to ONGOING...")
            await self._update_meeting_status(meeting_id, MeetingStatus.ONGOING)
            logger.info(f"✅ Meeting {meeting_id} status updated to ONGOING")

            # Route to appropriate platform handler
            if platform == "zoom":
                logger.info(f"🎯 Routing to Zoom SDK bot for meeting {meeting_id}...")
                result = await self._process_zoom_meeting(meeting_id, meeting_url, bot_name)
            elif platform == "msteams":
                logger.info(f"🎯 Routing to Node.js processor for Teams meeting {meeting_id}...")
                result = await self._call_node_processor(meeting_url, meeting_id, bot_name)
            elif platform == "googlemeet":
                logger.info(f"🎯 Routing to Node.js processor for Google Meet {meeting_id}...")
                result = await self._call_node_processor(meeting_url, meeting_id, bot_name)
            else:
                raise Exception(f"Unsupported platform: {platform}")

            logger.info(
                f"🎯 Platform processor returned for meeting {meeting_id}: {result}"
            )

            # Update database with results
            logger.info(
                f"💾 Updating database with results for meeting {meeting_id}..."
            )
            await self._update_meeting_with_results(meeting_id, result)
            logger.info(f"✅ Database updated with results for meeting {meeting_id}")

            return result

        except Exception as e:
            logger.error(f"❌ Failed to process meeting {meeting_id}: {e}")
            logger.exception(f"Full exception details for meeting {meeting_id}")

            # Check current meeting status to determine appropriate action
            # Rule: Once a meeting reaches "ongoing", it can NEVER go back to "not_joined"
            # It's a one-way street: not_joined → ongoing → completed
            try:
                # Get current meeting status
                db = await get_db_connection()
                meeting_service = MeetingService(db)
                current_meeting = await meeting_service.get_meeting_by_id(meeting_id)

                if current_meeting and current_meeting.status == MeetingStatus.ONGOING:
                    # Meeting is already ongoing - can only go to completed, never back to not_joined
                    logger.info(
                        f"🔄 Meeting {meeting_id} is in ONGOING status - marking as COMPLETED (one-way progression)"
                    )
                    await self._update_meeting_status(
                        meeting_id, MeetingStatus.COMPLETED
                    )

                    return {
                        "success": False,
                        "message": f"Meeting completed - subprocess error after reaching ongoing status: {str(e)}",
                        "videoLink": None,
                        "mappedTranscriptLink": None,
                        "error": str(e),
                        "reason": "ongoing_to_completed",
                    }
                else:
                    # Meeting was never ongoing - analyze error type for appropriate handling
                    error_message = str(e).lower()

                    # Check if this is a bot join failure (bot tried but wasn't accepted)
                    if any(
                        keyword in error_message
                        for keyword in [
                            "not admitted",
                            "not accepted",
                            "waiting room",
                            "lobby",
                            "permission denied",
                            "access denied",
                            "unauthorized",
                            "meeting locked",
                            "meeting ended",
                            "invalid meeting",
                            "failed to join",
                            "connection failed",
                            "authentication failed",
                        ]
                    ):
                        # Bot attempted to join but was rejected - mark as completed
                        logger.info(
                            f"🔄 Marking meeting {meeting_id} as COMPLETED (bot join rejected: {error_message})"
                        )
                        await self._update_meeting_status(
                            meeting_id, MeetingStatus.COMPLETED
                        )

                        return {
                            "success": False,
                            "message": f"Meeting completed - bot join rejected: {str(e)}",
                            "videoLink": None,
                            "mappedTranscriptLink": None,
                            "error": str(e),
                            "reason": "bot_join_rejected",
                        }
                    else:
                        # System error before reaching ongoing - allow retry
                        logger.info(
                            f"🔄 Marking meeting {meeting_id} as NOT_JOINED (system error before ongoing status)"
                        )
                        await self._update_meeting_status(
                            meeting_id, MeetingStatus.NOT_JOINED
                        )

                        return {
                            "success": False,
                            "message": f"Processing failed (system error): {str(e)}",
                            "videoLink": None,
                            "mappedTranscriptLink": None,
                            "error": str(e),
                            "reason": "system_error_before_ongoing",
                        }

            except Exception as update_error:
                logger.error(
                    f"Failed to update meeting status after error: {update_error}"
                )

            return {
                "success": False,
                "message": f"Processing failed: {str(e)}",
                "videoLink": None,
                "mappedTranscriptLink": None,
                "error": str(e),
            }

    async def _process_zoom_meeting(
        self, meeting_id: str, meeting_url: str, bot_name: str
    ) -> Dict[str, Any]:
        """
        Process a Zoom meeting using the Zoom SDK bot
        
        Args:
            meeting_id: Database ID for the meeting
            meeting_url: Zoom meeting URL
            bot_name: Display name for the bot
            
        Returns:
            Dictionary with processing results
        """
        try:
            logger.info(f"🎥 Starting Zoom SDK bot for meeting {meeting_id}")
            
            # Join the meeting using Zoom SDK service
            success = await zoom_sdk_service.join_meeting(
                meeting_db_id=meeting_id,
                meeting_url=meeting_url,
                bot_name=bot_name
            )
            
            if not success:
                logger.error(f"❌ Failed to start Zoom SDK bot for meeting {meeting_id}")
                return {
                    "success": False,
                    "message": "Failed to start Zoom SDK bot",
                    "videoLink": None,
                    "mappedTranscriptLink": None,
                }
            
            logger.info(f"✅ Zoom SDK bot started successfully for meeting {meeting_id}")
            
            # Note: The Zoom SDK bot runs in a separate process and will handle transcription
            # Transcripts will be periodically synced to database by a background task
            # or retrieved when the meeting ends
            
            # Schedule transcript update task (will update database periodically)
            asyncio.create_task(self._monitor_zoom_transcripts(meeting_id))
            
            return {
                "success": True,
                "message": "Zoom SDK bot joined meeting successfully",
                "videoLink": None,  # Zoom SDK bot doesn't record video by default
                "mappedTranscriptLink": f"/tmp/zoom_transcript_{meeting_id}.json",  # Transcript location
            }
            
        except Exception as e:
            logger.error(f"💥 Error processing Zoom meeting {meeting_id}: {e}")
            logger.exception(f"Full exception details:")
            return {
                "success": False,
                "message": f"Zoom SDK bot error: {str(e)}",
                "videoLink": None,
                "mappedTranscriptLink": None,
            }

    async def _monitor_zoom_transcripts(self, meeting_id: str):
        """
        Monitor and periodically update transcripts for a Zoom meeting
        
        Args:
            meeting_id: Database ID for the meeting
        """
        try:
            logger.info(f"Starting transcript monitoring for meeting {meeting_id}")
            
            # Wait a bit for meeting to start
            await asyncio.sleep(30)
            
            # Update transcripts every 30 seconds while meeting is ongoing
            max_iterations = 240  # Max 2 hours (240 * 30 seconds)
            for i in range(max_iterations):
                try:
                    # Try to update transcripts
                    success = await zoom_sdk_service.update_meeting_transcripts(meeting_id)
                    if success:
                        logger.info(f"Updated transcripts for meeting {meeting_id} (iteration {i+1})")
                    
                    # Check if meeting is still ongoing
                    db = await get_db_connection()
                    meeting_service = MeetingService(db)
                    meeting = await meeting_service.get_meeting_by_id(meeting_id)
                    
                    if not meeting or meeting.status not in ["ongoing"]:
                        logger.info(f"Meeting {meeting_id} no longer ongoing, stopping transcript monitoring")
                        # One final update
                        await zoom_sdk_service.update_meeting_transcripts(meeting_id)
                        break
                    
                    # Wait before next update
                    await asyncio.sleep(30)
                    
                except Exception as e:
                    logger.error(f"Error updating transcripts for meeting {meeting_id}: {e}")
                    await asyncio.sleep(30)
                    
        except Exception as e:
            logger.error(f"Error in transcript monitoring for meeting {meeting_id}: {e}")

    async def _call_node_processor(
        self, meeting_url: str, meeting_id: str, bot_name: str
    ) -> Dict[str, Any]:
        """Call the Node.js meeting processor"""
        try:
            logger.info(f"📞 Calling Node.js processor: {self.node_processor_path}")
            logger.info(f"📁 Working directory: {self.working_directory}")
            logger.info(f"🔍 Checking if Node.js processor file exists...")

            if not self.node_processor_path.exists():
                logger.error(
                    f"❌ Node.js processor file not found: {self.node_processor_path}"
                )
                return {
                    "success": False,
                    "message": f"Node.js processor file not found: {self.node_processor_path}",
                    "videoLink": None,
                    "mappedTranscriptLink": None,
                }

            logger.info(f"✅ Node.js processor file exists")

            # Prepare the command
            cmd = [
                "node",
                str(self.node_processor_path),
                meeting_url,
                meeting_id,
                bot_name,
            ]

            logger.info(f"🚀 Running command: {' '.join(cmd)}")
            logger.info(f"📂 Working directory: {self.working_directory}")

            # Run the Node.js process
            logger.info(f"🔄 Creating subprocess...")
            process = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=str(self.working_directory),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=None,  # Use current environment (includes .env variables)
            )
            logger.info(f"✅ Subprocess created, PID: {process.pid}")

            # process_id is no longer persisted (pod-per-meeting refactor dropped
            # the column). Termination is handled in-process via the subprocess
            # handle: monitor_with_stop_check() below watches the meeting status
            # and calls process.terminate()/process.kill() directly. A cross-
            # worker stop request sets status=completed, which this loop detects.

            # Stream output in real-time
            stdout_data = []
            stderr_data = []

            async def read_stream(stream, data_list, stream_name):
                """Read from stream and log in real-time"""
                try:
                    while True:
                        line = await stream.readline()
                        if not line:
                            break
                        line_text = line.decode("utf-8").rstrip()
                        if line_text:  # Only log non-empty lines
                            logger.info(f"[Node.js {stream_name}] {line_text}")
                            data_list.append(line_text)
                except Exception as e:
                    logger.error(f"Error reading {stream_name}: {e}")

            # Create tasks to read both stdout and stderr concurrently
            stdout_task = asyncio.create_task(
                read_stream(process.stdout, stdout_data, "stdout")
            )
            stderr_task = asyncio.create_task(
                read_stream(process.stderr, stderr_data, "stderr")
            )

            # Monitor process with external stop polling
            async def monitor_with_stop_check():
                """Monitor process and check if status changed to 'completed' (external stop) every 5 seconds"""
                while process.returncode is None:
                    try:
                        # Check if meeting was externally stopped (status changed to completed)
                        db = await get_db_connection()
                        meeting_service = MeetingService(db)
                        if await meeting_service.check_if_externally_stopped(meeting_id):
                            logger.warning(f"🛑 External stop detected for meeting {meeting_id} - terminating process")
                            process.terminate()
                            # Wait a bit for graceful shutdown
                            try:
                                await asyncio.wait_for(process.wait(), timeout=10)
                            except asyncio.TimeoutError:
                                # Force kill if needed
                                logger.warning(f"⚠️ Process didn't terminate gracefully, forcing kill")
                                process.kill()
                                await process.wait()
                            raise Exception("Meeting terminated by external stop request")
                        
                        # Wait for process or timeout (5 second poll interval)
                        try:
                            await asyncio.wait_for(process.wait(), timeout=5)
                            break  # Process completed
                        except asyncio.TimeoutError:
                            continue  # Still running, check again
                    except Exception as e:
                        if "Meeting terminated by external stop request" in str(e):
                            raise
                        logger.error(f"Error in stop check loop: {e}")
                        # Continue monitoring even if check fails
                        await asyncio.sleep(5)

            # Wait for process to complete with stop monitoring.
            # The previous hard-coded value was 30000s (~8.3h) with a stale
            # "5 hour max" comment — this raced with the bot's own 8h
            # MSTEAMS_MAX_MEETING_MS guard. Env-driven now so the wrapper
            # always trails the in-bot guard by a defined grace.
            bot_timeout_s = int(
                os.environ.get(
                    "BOT_SUBPROCESS_TIMEOUT_S",
                    str(_DEFAULT_BOT_SUBPROCESS_TIMEOUT_S),
                )
            )
            try:
                await asyncio.wait_for(
                    asyncio.gather(
                        monitor_with_stop_check(),
                        stdout_task,
                        stderr_task,
                        return_exceptions=True,
                    ),
                    timeout=bot_timeout_s,
                )
            except asyncio.TimeoutError:
                logger.error(
                    "Meeting processing timed out after %s seconds",
                    bot_timeout_s,
                )
                if process.returncode is None:
                    process.kill()
                    await process.wait()
                raise

            # Combine output for parsing
            stdout_text = "\n".join(stdout_data)
            stderr_text = "\n".join(stderr_data)

            logger.info(f"🏁 Subprocess completed with exit code: {process.returncode}")

            if stderr_text:
                logger.warning(
                    f"⚠️ Node.js processor had stderr output (already logged above)"
                )

            # Check exit code
            if process.returncode == 0:
                # Parse the result from stdout
                logger.info(f"✅ Node.js processor succeeded, parsing output...")
                result = self._parse_processor_output(stdout_text)
                result["success"] = True
                logger.info(f"🎉 Meeting processing completed successfully")
                return result
            else:
                logger.error(
                    f"❌ Node.js processor failed with exit code: {process.returncode}"
                )
                return {
                    "success": False,
                    "message": f"Processor failed with exit code {process.returncode}",
                    "stdout": stdout_text,
                    "stderr": stderr_text,
                    "videoLink": None,
                    "mappedTranscriptLink": None,
                }

        except asyncio.TimeoutError:
            bot_timeout_s = int(
                os.environ.get(
                    "BOT_SUBPROCESS_TIMEOUT_S",
                    str(_DEFAULT_BOT_SUBPROCESS_TIMEOUT_S),
                )
            )
            logger.error(
                "Meeting processing timed out after %s seconds", bot_timeout_s
            )
            return {
                "success": False,
                "message": f"Processing timed out after {bot_timeout_s} seconds",
                "videoLink": None,
                "mappedTranscriptLink": None,
            }
        except Exception as e:
            logger.error(f"💥 Error calling Node.js processor: {e}")
            logger.exception(f"Full exception details:")
            return {
                "success": False,
                "message": f"Failed to call processor: {str(e)}",
                "videoLink": None,
                "mappedTranscriptLink": None,
            }

    def _parse_processor_output(self, output: str) -> Dict[str, Any]:
        """Parse the output from the Node.js processor"""
        try:
            # Look for specific output patterns
            video_link = None
            transcript_link = None
            message = "Meeting processed"
            join_failed = False

            lines = output.split("\n")
            for line in lines:
                line_lower = line.lower()

                # Case-insensitive parsing for video links
                if "video available at:" in line_lower:
                    # Find the actual case in the original line
                    idx = line_lower.find("video available at:")
                    if idx != -1:
                        video_link = line[idx + len("video available at:") :].strip()
                elif "🎥 video link:" in line_lower:
                    idx = line_lower.find("🎥 video link:")
                    if idx != -1:
                        video_link = line[idx + len("🎥 video link:") :].strip()

                # Case-insensitive parsing for transcript links
                elif "transcript available at:" in line_lower:
                    idx = line_lower.find("transcript available at:")
                    if idx != -1:
                        transcript_link = line[
                            idx + len("transcript available at:") :
                        ].strip()
                elif "📝 transcript link:" in line_lower:
                    idx = line_lower.find("📝 transcript link:")
                    if idx != -1:
                        transcript_link = line[
                            idx + len("📝 transcript link:") :
                        ].strip()

                # Meeting completion message
                elif "meeting processing completed:" in line_lower:
                    idx = line_lower.find("meeting processing completed:")
                    if idx != -1:
                        message = line[
                            idx + len("meeting processing completed:") :
                        ].strip()

                # Check for bot join failure indicators
                elif any(
                    keyword in line_lower
                    for keyword in [
                        "not admitted",
                        "not accepted",
                        "waiting room",
                        "lobby",
                        "permission denied",
                        "access denied",
                        "unauthorized",
                        "meeting locked",
                        "meeting ended",
                        "invalid meeting",
                        "failed to join",
                        "connection failed",
                        "authentication failed",
                    ]
                ):
                    join_failed = True
                    message = f"Bot join failed: {line.strip()}"

            result = {
                "message": message,
                "videoLink": video_link,
                "mappedTranscriptLink": transcript_link,
            }

            # Add join failure flag for downstream processing
            if join_failed:
                result["join_failed"] = join_failed  # Now explicitly bool type

            return result

        except Exception as e:
            logger.warning(f"Failed to parse processor output: {e}")
            return {
                "message": "Processing completed (parse error)",
                "videoLink": None,
                "mappedTranscriptLink": None,
            }

    async def _update_meeting_status(self, meeting_id: str, status: MeetingStatus):
        """Update meeting status in database"""
        try:
            db = await get_db_connection()
            meeting_service = MeetingService(db)
            await meeting_service.update_meeting_status(meeting_id, status)
            logger.info(f"📝 Updated meeting {meeting_id} status to {status.value}")
        except Exception as e:
            logger.error(f"Failed to update meeting status: {e}")

    async def _update_meeting_with_results(
        self, meeting_id: str, result: Dict[str, Any]
    ):
        """Update meeting with processing results"""
        try:
            db = await get_db_connection()
            meeting_service = MeetingService(db)

            # Get current meeting status to respect one-way progression
            current_meeting = await meeting_service.get_meeting_by_id(meeting_id)

            # Prepare update data
            update_data = {}

            if result.get("videoLink"):
                update_data["video_link"] = result["videoLink"]

            # For transcript, we need to handle it properly
            if result.get("mappedTranscriptLink"):
                # Store the transcript link in the transcript field as metadata
                update_data["transcript"] = {
                    "mapped_transcript_link": result["mappedTranscriptLink"],
                    "processed_at": datetime.now(timezone.utc).isoformat(),
                    "success": result.get("success", False),
                }

            # Determine status based on success, join failure, and current status
            # Rule: Once ongoing, can only go to completed (one-way progression)
            if current_meeting and current_meeting.status == MeetingStatus.ONGOING:
                # Meeting is ongoing - can only go to completed, never back to not_joined
                status = MeetingStatus.COMPLETED
                logger.info(
                    f"📝 Meeting {meeting_id} is ONGOING - marking as COMPLETED (one-way progression)"
                )
            elif result.get("join_failed"):
                # Bot tried to join but was rejected - mark as completed
                status = MeetingStatus.COMPLETED
                logger.info(
                    f"📝 Marking meeting {meeting_id} as COMPLETED (bot join failed)"
                )
            elif result.get("success"):
                # Bot successfully joined and processed - mark as completed
                status = MeetingStatus.COMPLETED
                logger.info(
                    f"📝 Marking meeting {meeting_id} as COMPLETED (processing successful)"
                )
            else:
                # System error and meeting was never ongoing - allow retry
                status = MeetingStatus.NOT_JOINED
                logger.info(
                    f"📝 Marking meeting {meeting_id} as NOT_JOINED (system error, never reached ongoing)"
                )

            # Update the meeting
            await meeting_service.update_meeting_status(
                meeting_id, status, **update_data
            )

            logger.info(f"✅ Updated meeting {meeting_id} with processing results")

        except Exception as e:
            logger.error(f"Failed to update meeting with results: {e}")

    async def stop_meeting(self, meeting_id: str) -> Dict[str, Any]:
        """
        Stop an ongoing meeting by routing to the appropriate platform handler

        Args:
            meeting_id: UUID of the meeting

        Returns:
            Dictionary with stop results
        """
        try:
            logger.info(f"🛑 Stopping meeting {meeting_id}...")

            # Get meeting details to determine platform
            db = await get_db_connection()
            meeting_service = MeetingService(db)
            meeting = await meeting_service.get_meeting_by_id(meeting_id)

            if not meeting:
                return {
                    "success": False,
                    "message": f"Meeting {meeting_id} not found",
                    "error": "meeting_not_found"
                }

            # Detect platform from meeting URL
            platform_detector = PlatformDetector()
            platform = platform_detector.detect_platform(meeting.meeting_url)

            logger.info(f"📱 Meeting {meeting_id} platform: {platform}")

            # Route to appropriate platform handler for stopping
            if platform == "zoom":
                logger.info(f"🎯 Stopping Zoom SDK bot for meeting {meeting_id}...")
                success = await zoom_sdk_service.leave_meeting(meeting_id)

                if success:
                    logger.info(f"✅ Successfully stopped Zoom SDK bot for meeting {meeting_id}")
                    return {
                        "success": True,
                        "message": f"Zoom meeting {meeting_id} stopped successfully",
                        "platform": "zoom"
                    }
                else:
                    logger.warning(f"⚠️ Failed to stop Zoom SDK bot for meeting {meeting_id}")
                    return {
                        "success": False,
                        "message": f"Failed to stop Zoom meeting {meeting_id}",
                        "error": "zoom_stop_failed",
                        "platform": "zoom"
                    }

            elif platform == "msteams":
                logger.info(f"🎯 Stopping Node.js processor for Teams meeting {meeting_id}...")
                # For Teams meetings, use the existing process termination logic
                success = await meeting_service.terminate_meeting_process(meeting_id)

                if success:
                    logger.info(f"✅ Successfully stopped Teams meeting {meeting_id}")
                    return {
                        "success": True,
                        "message": f"Teams meeting {meeting_id} stopped successfully",
                        "platform": "msteams"
                    }
                else:
                    logger.warning(f"⚠️ Failed to stop Teams meeting {meeting_id}")
                    return {
                        "success": False,
                        "message": f"Failed to stop Teams meeting {meeting_id}",
                        "error": "teams_stop_failed",
                        "platform": "msteams"
                    }

            elif platform == "googlemeet":
                logger.info(f"🎯 Stopping Node.js processor for Google Meet {meeting_id}...")
                # For Google Meet, use the same process termination logic as Teams
                success = await meeting_service.terminate_meeting_process(meeting_id)

                if success:
                    logger.info(f"✅ Successfully stopped Google Meet {meeting_id}")
                    return {
                        "success": True,
                        "message": f"Google Meet {meeting_id} stopped successfully",
                        "platform": "googlemeet"
                    }
                else:
                    logger.warning(f"⚠️ Failed to stop Google Meet {meeting_id}")
                    return {
                        "success": False,
                        "message": f"Failed to stop Google Meet {meeting_id}",
                        "error": "googlemeet_stop_failed",
                        "platform": "googlemeet"
                    }

            else:
                return {
                    "success": False,
                    "message": f"Unsupported platform: {platform}",
                    "error": "unsupported_platform",
                    "platform": platform
                }

        except Exception as e:
            logger.error(f"❌ Failed to stop meeting {meeting_id}: {e}")
            return {
                "success": False,
                "message": f"Failed to stop meeting: {str(e)}",
                "error": str(e)
            }


# Global instance
meeting_processor_bridge = MeetingProcessorBridge()
