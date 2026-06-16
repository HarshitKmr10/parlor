"""
Zoom SDK Docker Service
Manages Zoom SDK bot Docker containers for joining and transcribing Zoom meetings
Each meeting runs in its own isolated Docker container
"""

import asyncio
import json
import logging
import os
from typing import Dict, Optional
from urllib.parse import parse_qs, urlparse

try:
    import docker
    from docker.models.containers import Container
    DOCKER_AVAILABLE = True
except ImportError:
    DOCKER_AVAILABLE = False
    logging.warning("docker package not available. Install with: pip install docker")

logger = logging.getLogger(__name__)


class ZoomSDKDockerService:
    """Service for managing Zoom SDK bot Docker containers"""

    def __init__(self):
        self.active_containers: Dict[str, Container] = {}
        self.docker_client = None
        
        if DOCKER_AVAILABLE:
            try:
                self.docker_client = docker.from_env()
                # Test connection
                self.docker_client.ping()
                logger.info("Docker client initialized successfully")
            except Exception as e:
                logger.error(f"Failed to initialize Docker client: {e}")
                self.docker_client = None

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
            parsed = urlparse(meeting_url)
            
            # Extract meeting ID from path
            meeting_id = None
            path_parts = parsed.path.split('/')
            
            for part in path_parts:
                if part.isdigit() and len(part) >= 9:
                    meeting_id = part
                    break
            
            if not meeting_id:
                logger.error(f"Could not extract meeting ID from URL: {meeting_url}")
                return None
            
            # Extract password from query parameters
            query_params = parse_qs(parsed.query)
            password = query_params.get('pwd', [''])[0]
            
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
        Join a Zoom meeting using the SDK bot in a Docker container
        
        Args:
            meeting_db_id: Database ID for the meeting
            meeting_url: Zoom meeting URL
            bot_name: Display name for the bot
            
        Returns:
            True if bot container started successfully, False otherwise
        """
        if not self.docker_client:
            logger.error("Docker client not available")
            return False
            
        try:
            # Parse meeting URL
            meeting_info = self.parse_zoom_url(meeting_url)
            if not meeting_info:
                logger.error(f"Failed to parse Zoom URL: {meeting_url}")
                return False
            
            meeting_id = meeting_info['meeting_id']
            meeting_password = meeting_info['password']
            
            # Get credentials from environment (support both naming conventions)
            client_id = os.environ.get('ZOOM_APP_CLIENT_ID') or os.environ.get('ZOOM_CLIENT_ID')
            client_secret = os.environ.get('ZOOM_APP_CLIENT_SECRET') or os.environ.get('ZOOM_CLIENT_SECRET')
            openai_api_key = os.environ.get('OPENAI_API_KEY')
            
            if not client_id or not client_secret:
                logger.error("ZOOM_CLIENT_ID and ZOOM_CLIENT_SECRET must be set")
                return False
            
            # Create transcript directory on host
            transcript_dir = "/tmp/zoom_transcripts"
            os.makedirs(transcript_dir, exist_ok=True)
            transcript_file = f"{transcript_dir}/zoom_transcript_{meeting_db_id}.json"
            
            logger.info(f"Starting Zoom SDK bot container for meeting {meeting_id}")
            
            # Prepare environment variables for container
            environment = {
                'ZOOM_APP_CLIENT_ID': client_id,
                'ZOOM_APP_CLIENT_SECRET': client_secret,
                'OPENAI_API_KEY': openai_api_key or '',
                'MEETING_ID': meeting_id,
                'MEETING_PWD': meeting_password,
                'BOT_NAME': bot_name,
                'MEETING_DB_ID': meeting_db_id,
                'TRANSCRIPT_FILE': f'/app/transcripts/zoom_transcript_{meeting_db_id}.json'
            }
            
            # Volume mounts for transcripts
            volumes = {
                transcript_dir: {
                    'bind': '/app/transcripts',
                    'mode': 'rw'
                }
            }
            
            # Start container
            container = self.docker_client.containers.run(
                image='zoom-sdk-bot:latest',
                name=f'zoom-bot-{meeting_db_id}',
                environment=environment,
                volumes=volumes,
                detach=True,
                auto_remove=True,  # Auto-remove when stopped
                network_mode='bridge'
            )
            
            # Store container reference
            self.active_containers[meeting_db_id] = container
            
            logger.info(f"Zoom SDK bot container started: {container.id[:12]} for meeting {meeting_id}")
            
            # Wait a bit to check if container is still running
            await asyncio.sleep(3)
            
            container.reload()
            if container.status != 'running':
                logger.error(f"Container {container.id[:12]} is not running. Status: {container.status}")
                logs = container.logs().decode('utf-8')
                logger.error(f"Container logs: {logs}")
                return False
            
            return True
            
        except Exception as e:
            logger.error(f"Error starting Zoom SDK bot container: {e}", exc_info=True)
            return False

    async def leave_meeting(self, meeting_db_id: str) -> bool:
        """
        Leave a Zoom meeting (stop the bot container)
        
        Args:
            meeting_db_id: Database ID for the meeting
            
        Returns:
            True if container was stopped successfully, False otherwise
        """
        try:
            container = self.active_containers.get(meeting_db_id)
            
            if not container:
                logger.warning(f"No active container found for meeting {meeting_db_id}")
                return False
            
            logger.info(f"Stopping Zoom SDK bot container for meeting {meeting_db_id}")
            
            # Stop container (will auto-remove due to auto_remove=True)
            container.stop(timeout=10)
            
            # Remove from active containers
            del self.active_containers[meeting_db_id]
            
            logger.info(f"Successfully stopped container for meeting {meeting_db_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error stopping container for meeting {meeting_db_id}: {e}")
            return False

    async def get_transcripts(self, meeting_db_id: str) -> Optional[list]:
        """
        Get transcripts for a meeting
        
        Args:
            meeting_db_id: Database ID for the meeting
            
        Returns:
            List of transcript entries, or None if not available
        """
        transcript_file = f"/tmp/zoom_transcripts/zoom_transcript_{meeting_db_id}.json"
        
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
        Update database with transcripts from completed meeting
        
        Args:
            meeting_db_id: Database ID for the meeting
            
        Returns:
            True if transcripts were updated, False otherwise
        """
        try:
            transcripts = await self.get_transcripts(meeting_db_id)
            if not transcripts:
                logger.warning(f"No transcripts found for meeting {meeting_db_id}")
                return False
            
            # Import here to avoid circular imports
            from ..api.database.connection import get_db_connection
            from ..services.meeting_service import MeetingService
            
            db = await get_db_connection()
            meeting_service = MeetingService(db)
            
            # Format transcripts for database
            transcript_data = {
                "content": transcripts,
                "format": "zoom_sdk",
                "speaker_labels": True,
                "total_entries": len(transcripts)
            }
            
            # Update meeting with transcripts
            await meeting_service.update_meeting_status(
                meeting_db_id,
                transcript=transcript_data
            )
            
            logger.info(f"Updated database with {len(transcripts)} transcript entries for meeting {meeting_db_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error updating transcripts for meeting {meeting_db_id}: {e}")
            return False

    def get_container_logs(self, meeting_db_id: str) -> Optional[str]:
        """Get logs from a container"""
        try:
            container = self.active_containers.get(meeting_db_id)
            if container:
                return container.logs().decode('utf-8')
        except Exception as e:
            logger.error(f"Error getting container logs: {e}")
        return None

    def cleanup(self):
        """Clean up all active containers"""
        logger.info(f"Cleaning up {len(self.active_containers)} active Zoom SDK bot containers")
        
        for meeting_id, container in list(self.active_containers.items()):
            try:
                container.stop(timeout=5)
                logger.info(f"Stopped container for meeting {meeting_id}")
            except Exception as e:
                logger.error(f"Error cleaning up container for meeting {meeting_id}: {e}")
        
        self.active_containers.clear()


# Global instance
zoom_sdk_docker_service = ZoomSDKDockerService()
