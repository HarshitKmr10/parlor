"""
Simple Zoom SDK Bot - Based on working transcription_bot.py
"""

import logging
import os
import jwt
from datetime import datetime, timedelta

# Initialize logger first before any imports that might need it
logger = logging.getLogger(__name__)

# Optional imports - only required for Zoom SDK functionality
try:
    import zoom_meeting_sdk as zoom
    import gi
    gi.require_version('GLib', '2.0')
    from gi.repository import GLib
    ZOOM_SDK_AVAILABLE = True
except ImportError as e:
    ZOOM_SDK_AVAILABLE = False
    logger.warning(f"Zoom SDK dependencies not available: {e}")
    logger.warning("Install pygobject to enable Zoom SDK bot functionality")

from .enhanced_transcriber import EnhancedMeetingTranscriber, normalized_rms_audio


def generate_jwt(client_id, client_secret):
    """
    Generate JWT token for Zoom SDK authentication
    
    Args:
        client_id: Zoom OAuth Client ID  
        client_secret: Zoom OAuth Client Secret
        
    Returns:
        JWT token string
    """
    iat = datetime.utcnow()
    exp = iat + timedelta(hours=24)

    payload = {
        "iat": int(iat.timestamp()),  # Must be Unix timestamp
        "exp": int(exp.timestamp()),   # Must be Unix timestamp
        "appKey": client_id,
        "tokenExp": int(exp.timestamp())
    }

    token = jwt.encode(payload, client_secret, algorithm="HS256")
    logger.debug(f"Generated JWT token with expiry: {exp}")
    return token


class SimpleZoomBot:
    """Simple Zoom bot based on the working transcription_bot.py"""

    def __init__(self, client_id, client_secret, meeting_id, meeting_password,
                 bot_name="Transcription Bot", meeting_db_id=None, transcript_file=None):
        self.client_id = client_id
        self.client_secret = client_secret
        self.meeting_id = meeting_id
        self.meeting_password = meeting_password
        self.bot_name = bot_name
        self.meeting_db_id = meeting_db_id

        # Services
        self.meeting_service = None
        self.setting_service = None
        self.auth_service = None
        self.auth_event = None
        self.recording_event = None
        self.meeting_service_event = None

        # Audio
        self.audio_source = None
        self.audio_helper = None
        self.audio_settings = None
        self.recording_ctrl = None
        self.audio_ctrl = None

        # Enhanced Transcriber using TranscribeService
        self.transcriber = None
        if meeting_db_id:
            self.transcriber = EnhancedMeetingTranscriber(meeting_db_id, transcript_file)

        # Participants
        self.my_participant_id = None
        self.participants_ctrl = None
        self.participants_ctrl_event = None

        logger.info(f"SimpleZoomBot initialized for meeting {meeting_id} (DB ID: {meeting_db_id})")

    def cleanup(self):
        logger.info("Cleaning up bot...")

        if self.transcriber:
            self.transcriber.finish()

        if self.audio_helper:
            try:
                self.audio_helper.unSubscribe()
            except:
                pass

        if self.meeting_service:
            try:
                zoom.DestroyMeetingService(self.meeting_service)
            except:
                pass

        if self.setting_service:
            try:
                zoom.DestroySettingService(self.setting_service)
            except:
                pass

        if self.auth_service:
            try:
                zoom.DestroyAuthService(self.auth_service)
            except:
                pass

        try:
            zoom.CleanUPSDK()
        except:
            pass

    def init(self):
        logger.info("Initializing Zoom SDK...")

        # CRITICAL: Ensure proper event loop context for callbacks
        import sys
        import os

        # Set environment for proper GUI context (even headless)
        os.environ.setdefault('DISPLAY', ':0')
        os.environ.setdefault('QT_QPA_PLATFORM', 'offscreen')

        init_param = zoom.InitParam()
        init_param.strWebDomain = "https://zoom.us"
        init_param.strSupportUrl = "https://zoom.us"
        init_param.enableGenerateDump = True
        init_param.emLanguageID = zoom.SDK_LANGUAGE_ID.LANGUAGE_English
        init_param.enableLogByDefault = True

        init_sdk_result = zoom.InitSDK(init_param)
        if init_sdk_result != zoom.SDKERR_SUCCESS:
            raise Exception(f'InitSDK failed with error: {init_sdk_result}')

        self.create_services()
        logger.info("Zoom SDK initialized successfully")

    def on_user_join_callback(self, joined_user_ids, user_name):
        logger.info(f"User joined: {user_name} (ID: {joined_user_ids})")

    def on_one_way_audio_raw_data_received_callback(self, data, node_id):
        """Handle received audio data"""
        if node_id == self.my_participant_id:
            return

        try:
            user = self.participants_ctrl.GetUserByUserID(node_id)
            speaker_name = user.GetUserName() if user else f"User {node_id}"
        except:
            speaker_name = f"User {node_id}"

        buffer_bytes = data.GetBuffer()
        volume = normalized_rms_audio(buffer_bytes)

        if volume > 0.01 and self.transcriber:
            self.transcriber.send(buffer_bytes, node_id, speaker_name)

    def on_join(self):
        logger.info("Successfully joined the meeting!")

        # Set up participants controller
        self.participants_ctrl = self.meeting_service.GetMeetingParticipantsController()
        self.participants_ctrl_event = zoom.MeetingParticipantsCtrlEventCallbacks(
            onUserJoinCallback=self.on_user_join_callback
        )
        self.participants_ctrl.SetEvent(self.participants_ctrl_event)
        self.my_participant_id = self.participants_ctrl.GetMySelfUser().GetUserID()
        logger.info(f"My participant ID: {self.my_participant_id}")

        # Set up recording
        self.recording_ctrl = self.meeting_service.GetMeetingRecordingController()

        def on_recording_privilege_changed(can_rec):
            logger.info(f"Recording privilege changed. Can record: {can_rec}")
            if can_rec:
                GLib.timeout_add_seconds(1, self.start_raw_recording)

        self.recording_event = zoom.MeetingRecordingCtrlEventCallbacks(
            onRecordPrivilegeChangedCallback=on_recording_privilege_changed
        )
        self.recording_ctrl.SetEvent(self.recording_event)

        # Try to start recording immediately
        GLib.timeout_add_seconds(1, self.start_raw_recording)

        # Set up audio controller
        self.audio_ctrl = self.meeting_service.GetMeetingAudioController()
        self.audio_ctrl.JoinVoip()
        logger.info("Joined VoIP audio")

    def start_raw_recording(self):
        """Start raw audio recording"""
        logger.info("Attempting to start raw recording...")

        can_start_recording_result = self.recording_ctrl.CanStartRawRecording()
        logger.info(f"CanStartRawRecording result: {can_start_recording_result}")

        if can_start_recording_result != zoom.SDKERR_SUCCESS:
            logger.info("Requesting recording privilege...")
            self.recording_ctrl.RequestLocalRecordingPrivilege()
            return False

        start_raw_recording_result = self.recording_ctrl.StartRawRecording()
        logger.info(f"StartRawRecording result: {start_raw_recording_result}")

        if start_raw_recording_result != zoom.SDKERR_SUCCESS:
            logger.error(f"Start raw recording failed: {start_raw_recording_result}")
            return False

        logger.info("✅ Raw recording started successfully!")

        # Notify meeting joiner service that recording has started
        self._notify_recording_started()

        # Set up audio helper
        self.audio_helper = zoom.GetAudioRawdataHelper()
        if self.audio_helper is None:
            logger.error("audio_helper is None")
            return False

        if self.audio_source is None:
            self.audio_source = zoom.ZoomSDKAudioRawDataDelegateCallbacks(
                onOneWayAudioRawDataReceivedCallback=self.on_one_way_audio_raw_data_received_callback
            )

        audio_helper_subscribe_result = self.audio_helper.subscribe(self.audio_source, False)
        logger.info(f"audio_helper.subscribe result: {audio_helper_subscribe_result}")

        if audio_helper_subscribe_result == zoom.SDKERR_SUCCESS:
            logger.info("✅ Audio helper subscribed - will receive audio!")

        return False

    def _notify_recording_started(self):
        """Notify the meeting joiner service that recording has started"""
        if not self.meeting_db_id:
            logger.warning("No meeting_db_id available, cannot notify recording start")
            return

        try:
            import asyncio
            import aiohttp
            import os

            # Get the meeting joiner API URL from environment
            meeting_joiner_url = os.getenv('MEETING_JOINER_API_URL', 'http://localhost:3000')

            # Create async task to update status
            asyncio.create_task(self._update_recording_status(meeting_joiner_url))

        except Exception as e:
            logger.error(f"Error notifying recording start: {e}")

    async def _update_recording_status(self, base_url):
        """Update meeting joiner status via HTTP API"""
        try:
            async with aiohttp.ClientSession() as session:
                url = f"{base_url}/api/meetings/{self.meeting_db_id}/recording-started"
                async with session.post(url, json={'status': 'recording'}) as response:
                    if response.status == 200:
                        logger.info(f"✅ Successfully notified recording start for meeting {self.meeting_db_id}")
                    else:
                        logger.warning(f"Failed to notify recording start: HTTP {response.status}")
        except Exception as e:
            logger.error(f"Error updating recording status: {e}")

    def join_meeting(self):
        logger.info(f"Joining meeting {self.meeting_id}...")

        meeting_number = int(self.meeting_id)

        join_param = zoom.JoinParam()
        join_param.userType = zoom.SDKUserType.SDK_UT_WITHOUT_LOGIN

        param = join_param.param
        param.meetingNumber = meeting_number
        param.userName = self.bot_name
        param.psw = self.meeting_password
        param.isVideoOff = True
        param.isAudioOff = True
        param.isAudioRawDataStereo = False
        param.isMyVoiceInMix = False
        param.eAudioRawdataSamplingRate = zoom.AudioRawdataSamplingRate.AudioRawdataSamplingRate_32K

        join_result = self.meeting_service.Join(join_param)
        logger.info(f"Join meeting result: {join_result}")

        self.audio_settings = self.setting_service.GetAudioSettings()
        self.audio_settings.EnableAutoJoinAudio(True)

    def auth_return(self, result):
        if result == zoom.AUTHRET_SUCCESS:
            logger.info("Auth completed successfully, joining meeting...")
            return self.join_meeting()

        raise Exception(f"Failed to authorize. result = {result}")

    def meeting_status_changed(self, status, iResult):
        logger.info(f"Meeting status changed: status={status}, iResult={iResult}")

        # Log status value for debugging
        status_val = status.value if hasattr(status, 'value') else int(status)
        status_name = status.name if hasattr(status, 'name') else 'unknown'
        logger.info(f"Status details - value: {status_val}, name: {status_name}")

        # Enhanced error logging for FAILED status
        if status == zoom.MEETING_STATUS_FAILED:
            error_messages = {
                3: "Incorrect meeting number or password",
                4: "Invalid meeting parameters",
                5: "Meeting does not exist",
                6: "Invalid Zoom user type",
                7: "Meeting expired or not started yet",
                8: "Meeting authentication failed - check OAuth credentials and meeting permissions",
                9: "Meeting is locked",
                10: "Meeting restricted (enterprise settings)",
                11: "JBH (Join Before Host) not allowed",
                12: "Invalid audio or video device",
                13: "Internal Zoom SDK error",
                14: "Meeting removed",
                15: "Meeting is full"
            }
            error_msg = error_messages.get(iResult, f"Unknown error code: {iResult}")
            logger.error(f"❌ MEETING FAILED - Error {iResult}: {error_msg}")
            logger.error(f"   Meeting ID: {self.meeting_id}")
            logger.error(f"   Bot Name: {self.bot_name}")
            logger.error(f"   Client ID: {self.client_id[:10]}...")
            logger.error("   Troubleshooting:")
            logger.error("   1. Check if meeting URL is valid and active")
            logger.error("   2. Verify Zoom OAuth app is configured as 'Meeting SDK' type")
            logger.error("   3. Ensure OAuth app has meeting:write and meeting:read:admin scopes")
            logger.error("   4. Check if meeting requires waiting room or host approval")
            return

        if status == zoom.MEETING_STATUS_INMEETING:
            logger.info("🎉 INMEETING status detected! Calling on_join()...")
            return self.on_join()
        elif status == zoom.MEETING_STATUS_CONNECTING:
            # WORKAROUND: Since INMEETING callback doesn't fire in multiprocess context,
            # trigger setup after CONNECTING with a delay to allow connection to complete
            logger.info("⚠️ CONNECTING status detected - scheduling fallback on_join() in 10s...")
            GLib.timeout_add_seconds(10, self._fallback_on_join)
        elif status == zoom.MEETING_STATUS_ENDED:
            logger.info("Meeting ended normally")
        else:
            logger.info(f"Still waiting for INMEETING status (current: {status_name})")

    def _fallback_on_join(self):
        """Fallback to call on_join if INMEETING callback never fired"""
        if not self.recording_ctrl:  # Only if not already set up
            logger.info("⚠️ INMEETING callback never fired - forcing on_join() as fallback")
            self.on_join()
        else:
            logger.info("✅ Recording already set up, skipping fallback")
        return False  # Don't repeat

    def leave(self):
        if self.meeting_service is None:
            return

        status = self.meeting_service.GetMeetingStatus()
        if status == zoom.MEETING_STATUS_IDLE:
            return

        self.meeting_service.Leave(zoom.LEAVE_MEETING)

    def create_services(self):
        logger.info("Creating Zoom SDK services...")

        self.meeting_service = zoom.CreateMeetingService()
        self.setting_service = zoom.CreateSettingService()

        self.meeting_service_event = zoom.MeetingServiceEventCallbacks(
            onMeetingStatusChangedCallback=self.meeting_status_changed
        )

        meeting_service_set_event_result = self.meeting_service.SetEvent(self.meeting_service_event)
        if meeting_service_set_event_result != zoom.SDKERR_SUCCESS:
            raise Exception("Meeting Service set event failed")

        self.auth_event = zoom.AuthServiceEventCallbacks(
            onAuthenticationReturnCallback=self.auth_return
        )

        self.auth_service = zoom.CreateAuthService()

        set_event_result = self.auth_service.SetEvent(self.auth_event)
        logger.info(f"Auth service set event result: {set_event_result}")

        # Authenticate
        auth_context = zoom.AuthContext()
        auth_context.jwt_token = generate_jwt(self.client_id, self.client_secret)

        result = self.auth_service.SDKAuth(auth_context)

        if result == zoom.SDKError.SDKERR_SUCCESS:
            logger.info("Authentication successful")
        else:
            logger.error(f"Authentication failed with error: {result}")

    def get_transcripts(self):
        if self.transcriber:
            return self.transcriber.get_transcripts()
        return []
