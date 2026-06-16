"""
Enhanced Meeting Transcriber for Zoom SDK Bot
Uses the multi-provider TranscribeService with database integration
"""

import io
import json
import logging
import os
import wave
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Any

from ...services.transcribe_service import TranscribeService, TranscriptionResult

logger = logging.getLogger(__name__)


class EnhancedMeetingTranscriber:
    """Enhanced transcriber using multi-provider TranscribeService with database integration"""

    def __init__(self, meeting_db_id: str, output_file: Optional[str] = None):
        """
        Initialize the enhanced transcriber

        Args:
            meeting_db_id: Database ID for the meeting
            output_file: Path to save transcript JSON (optional)
        """
        self.meeting_db_id = meeting_db_id
        self.transcribe_service = TranscribeService()
        self.audio_buffer = bytearray()
        self.buffer_size_threshold = 32000 * 10  # About 10 seconds at 32kHz
        self.sample_rate = 32000
        self.channels = 1  # Mono
        self.sample_width = 2  # 16-bit
        self.active = True
        self.output_file = output_file
        self.transcripts = []
        self.all_segments = []  # Store all segments for database
        self.segment_count = 0  # Track segment numbers like Teams
        self.stored_segment_ids = set()  # Track which segments have been stored
        self.meeting_start_time = datetime.now(timezone.utc)  # Track when meeting started for wall-clock timing
        self.executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="enhanced-transcriber")

        logger.info(f"EnhancedMeetingTranscriber initialized for meeting {meeting_db_id}")

    def send(self, audio_data: bytes, speaker_id: int, speaker_name: str):
        """
        Accumulate audio data and transcribe when buffer is full

        Args:
            audio_data: Raw PCM audio data
            speaker_id: ID of the speaker
            speaker_name: Name of the speaker
        """
        if not self.active:
            return

        self.audio_buffer.extend(audio_data)

        if len(self.audio_buffer) >= self.buffer_size_threshold:
            audio_chunk = bytes(self.audio_buffer)
            self.audio_buffer.clear()
            self.executor.submit(self._transcribe_audio, audio_chunk, speaker_id, speaker_name)

    def _transcribe_audio(self, audio_data: bytes, speaker_id: int, speaker_name: str):
        """
        Convert PCM audio data to WAV format and send to TranscribeService

        Args:
            audio_data: Raw PCM audio data
            speaker_id: ID of the speaker
            speaker_name: Name of the speaker
        """
        try:
            # Convert raw PCM to WAV format
            wav_buffer = io.BytesIO()
            with wave.open(wav_buffer, 'wb') as wav_file:
                wav_file.setnchannels(self.channels)
                wav_file.setsampwidth(self.sample_width)
                wav_file.setframerate(self.sample_rate)
                wav_file.writeframes(audio_data)

            wav_data = wav_buffer.getvalue()

            # Transcribe using the service
            import asyncio
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

            try:
                result = loop.run_until_complete(
                    self.transcribe_service.transcribe_audio(
                        wav_data,
                        str(speaker_id),
                        speaker_name
                    )
                )
            finally:
                loop.close()

            if result and result.text.strip():
                # Calculate elapsed time from meeting start (wall-clock time)
                # This is immune to skipped chunks or processing delays
                elapsed_seconds = (datetime.now(timezone.utc) - self.meeting_start_time).total_seconds()
                
                # Store transcription with speaker info (original format)
                transcript_entry = {
                    "timestamp": result.timestamp,
                    "speaker_id": result.speaker_id,
                    "speaker_name": result.speaker_name,
                    "text": result.text.strip(),
                    "provider": result.provider
                }

                self.transcripts.append(transcript_entry)

                # Store segments for database (transcribeProcessor format)
                # Store ORIGINAL segment times (relative to chunk) - offsetting happens at DB storage time
                if result.segments:
                    for segment in result.segments:
                        segment_text = segment.get("text", "").strip()
                        
                        # Skip very short segments (less than 10 characters)
                        if len(segment_text) < 10:
                            continue
                        
                        # Store original segment with elapsed_seconds metadata for later offsetting
                        segment_with_metadata = segment.copy()
                        segment_with_metadata["_chunk_elapsed_seconds"] = elapsed_seconds  # Metadata for DB storage
                        
                        # Skip if we already have this exact or highly similar text
                        is_duplicate = False
                        for existing in self.all_segments:
                            existing_text = existing.get("text", "").strip()
                            
                            # Check for exact match
                            if existing_text == segment_text:
                                is_duplicate = True
                                break
                            
                            # Check for high similarity (one text contains the other and lengths are similar)
                            if len(segment_text) > 20 and len(existing_text) > 20:
                                if (segment_text in existing_text and len(segment_text) > len(existing_text) * 0.8):
                                    is_duplicate = True
                                    break
                                if (existing_text in segment_text and len(existing_text) > len(segment_text) * 0.8):
                                    is_duplicate = True
                                    break
                        
                        if not is_duplicate:
                            self.all_segments.append(segment_with_metadata)
                        else:
                            logger.debug(f"Skipped duplicate segment: {segment_text[:50]}...")

                # Save to file if specified
                if self.output_file:
                    self._save_transcript(transcript_entry)

                logger.info(f"[{speaker_name}] ({result.provider}): {result.text.strip()}")

                # Store in database periodically
                self._store_in_database_async()

        except Exception as e:
            logger.error(f"Error during enhanced transcription: {e}", exc_info=True)

    def _save_transcript(self, transcript_entry: dict):
        """
        Save transcript entry to JSON file

        Args:
            transcript_entry: Transcript entry dictionary
        """
        try:
            # Read existing transcripts
            transcripts = []
            if os.path.exists(self.output_file):
                try:
                    with open(self.output_file, 'r') as f:
                        transcripts = json.load(f)
                except:
                    transcripts = []

            # Add new entry
            transcripts.append(transcript_entry)

            # Write back to file
            with open(self.output_file, 'w') as f:
                json.dump(transcripts, f, indent=2)

        except Exception as e:
            logger.error(f"Failed to save transcript: {e}")

    def _store_in_database_async(self):
        """Store NEW transcripts in database asynchronously without event loop conflicts"""
        try:
            if not self.all_segments:
                return

            # Find segments that haven't been stored yet
            new_segments = []
            for idx, segment in enumerate(self.all_segments):
                segment_id = f"{segment.get('speaker', 'Unknown')}_{segment.get('start', 0)}_{segment.get('end', 0)}"
                if segment_id not in self.stored_segment_ids:
                    new_segments.append((idx, segment, segment_id))
            
            if not new_segments:
                return
                
            # Log the latest segment for debugging
            latest_idx, latest_segment, _ = new_segments[-1]
            logger.info(f"Transcript segment captured: [{latest_segment.get('speaker', 'Unknown')}]: {latest_segment.get('text', '')}")

            # Store new segments using a separate thread with its own event loop
            self.executor.submit(self._store_transcripts_threaded, new_segments)

        except Exception as e:
            logger.error(f"Failed to store transcript segment: {e}")

    def _store_transcripts_threaded(self, new_segments=None):
        """Store transcripts in database using a new event loop in a separate thread"""
        try:
            import asyncio
            from ...services.meeting_service import MeetingService
            from datetime import datetime, timezone

            # Create a new event loop for this thread
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

            try:
                # Run the database storage coroutine
                loop.run_until_complete(self._store_transcripts_in_database(new_segments))
            finally:
                loop.close()

        except Exception as e:
            logger.error(f"Failed to store transcripts in threaded database storage: {e}", exc_info=True)

    async def _store_transcripts_in_database(self, new_segments=None):
        """
        Actually store transcripts in database by appending segments individually
        This matches the Teams approach for consistent frontend behavior
        
        Args:
            new_segments: List of tuples (idx, segment, segment_id) for new segments to store
        """
        try:
            # If no new segments provided, process all segments (for backward compatibility)
            if new_segments is None:
                new_segments = [
                    (idx, segment, f"{segment.get('speaker', 'Unknown')}_{segment.get('start', 0)}_{segment.get('end', 0)}")
                    for idx, segment in enumerate(self.all_segments)
                    if f"{segment.get('speaker', 'Unknown')}_{segment.get('start', 0)}_{segment.get('end', 0)}" not in self.stored_segment_ids
                ]
            
            if not new_segments:
                return

            from ...api.database.connection import DatabaseConnection
            from datetime import datetime, timezone

            # Initialize database connection
            db = DatabaseConnection()
            await db.connect()

            logger.info(f"Appending {len(new_segments)} new transcript segments for meeting {self.meeting_db_id}")

            # Append each segment individually with unique timestamp (like Teams does)
            for idx, segment, segment_id in new_segments:
                self.segment_count += 1
                
                # Calculate absolute meeting time by adding chunk elapsed time + segment relative time
                # segment["start"] is relative to the audio chunk (0-10s typically)
                # segment["_chunk_elapsed_seconds"] is when the chunk started in the meeting
                chunk_elapsed = segment.get("_chunk_elapsed_seconds", 0)
                segment_relative_time = segment.get("start", 0)
                absolute_meeting_time = chunk_elapsed + segment_relative_time
                
                # Calculate timestamp relative to meeting start
                segment_timestamp = self.meeting_start_time + timedelta(seconds=absolute_meeting_time)
                
                # Create segment data with unique timestamp for each segment
                segment_data = {
                    "timestamp": segment_timestamp.isoformat(),  # ✅ Correctly calculated meeting-relative timestamp
                    "speaker": segment.get("speaker", "Unknown"),
                    "text": segment.get("text", ""),
                    "startTime": absolute_meeting_time,  # Actual elapsed seconds from meeting start
                    "endTime": chunk_elapsed + segment.get("end", 0),  # Also offset the end time
                    "confidence": segment.get("confidence", 0.9),
                    "provider": "openai",
                    "speakerId": segment.get("speaker", "Unknown"),
                    "segmentNumber": self.segment_count,
                    "isRealTime": True,
                    "appendedAt": datetime.now(timezone.utc).isoformat()
                }
                
                try:
                    # Get current transcript via the pluggable store.
                    current_meeting = await db.store.get_meeting(self.meeting_db_id)

                    if current_meeting and current_meeting.transcript:
                        import copy
                        existing_transcript = copy.deepcopy(dict(current_meeting.transcript))
                        if not isinstance(existing_transcript.get("content"), list):
                            existing_transcript["content"] = []
                        existing_transcript["content"].append(segment_data)
                        existing_transcript["lastUpdated"] = int(datetime.now(timezone.utc).timestamp() * 1000)
                        existing_transcript["totalSegments"] = len(existing_transcript["content"])
                        existing_transcript["lastSegmentTime"] = segment_data.get("timestamp")
                    else:
                        existing_transcript = {
                            "content": [segment_data],
                            "timestamp": segment_data.get("timestamp"),
                            "lastUpdated": int(datetime.now(timezone.utc).timestamp() * 1000),
                            "totalSegments": 1,
                            "lastSegmentTime": segment_data.get("timestamp")
                        }
                    
                    # Update using the working update_transcript method
                    from ...services.meeting_service import MeetingService
                    meeting_service = MeetingService(db)
                    await meeting_service.update_transcript(
                        meeting_id=self.meeting_db_id,
                        transcript_data=existing_transcript
                    )
                    
                    # Mark this segment as stored
                    self.stored_segment_ids.add(segment_id)
                    
                    logger.debug(f"✅ Appended segment {self.segment_count} to database for meeting {self.meeting_db_id}")
                    
                except Exception as segment_error:
                    logger.error(f"Failed to append segment {self.segment_count}: {segment_error}")
                    # Continue with other segments even if one fails

            logger.info(f"Successfully appended {len(new_segments)} transcript segments for meeting {self.meeting_db_id}")

            # Close database connection
            await db.disconnect()

        except Exception as e:
            logger.error(f"Failed to store transcripts in database: {e}", exc_info=True)
            # Try to close database connection in case of error
            try:
                if 'db' in locals():
                    await db.disconnect()
            except:
                pass

    def _store_in_database(self):
        """Store transcripts in database using meeting service - disabled due to event loop issues"""
        try:
            if not self.all_segments:
                return

            logger.info(f"Transcript storage disabled - would store {len(self.all_segments)} segments for meeting {self.meeting_db_id}")

        except Exception as e:
            logger.error(f"Failed to store transcripts in database: {e}", exc_info=True)

    def get_transcripts(self) -> List[Dict[str, Any]]:
        """Get all transcripts collected so far (original format)"""
        return self.transcripts

    def get_segments(self) -> List[Dict[str, Any]]:
        """Get all segments in transcribeProcessor format"""
        return self.all_segments

    def get_transcribe_processor_format(self) -> Dict[str, Any]:
        """Get transcript in transcribeProcessor.js compatible format"""
        return {
            "text": " ".join([segment["text"] for segment in self.all_segments]),
            "segments": self.all_segments
        }

    def finish(self):
        """Process any remaining audio data and stop transcription"""
        self.active = False
        if len(self.audio_buffer) > 0:
            # Process remaining audio
            audio_data = bytes(self.audio_buffer)
            self.audio_buffer.clear()
            # Use a generic speaker for remaining data
            self.executor.submit(self._transcribe_audio, audio_data, -1, "Unknown Speaker")

        # Wait for all transcription tasks to complete
        self.executor.shutdown(wait=True)

        # Final database update using threaded approach
        if self.all_segments:
            logger.info(f"Performing final database storage for {len(self.all_segments)} segments")
            try:
                # Use the threaded database storage for final update
                self._store_transcripts_threaded()
            except Exception as e:
                logger.error(f"Failed final database storage: {e}")

        logger.info(f"EnhancedMeetingTranscriber finished for meeting {self.meeting_db_id}")


def normalized_rms_audio(pcm_data: bytes, sample_width: int = 2) -> float:
    """
    Calculate normalized RMS amplitude of PCM audio data

    Args:
        pcm_data: Raw PCM audio bytes
        sample_width: Bytes per sample (default: 2 for 16-bit)

    Returns:
        Normalized RMS value between 0.0 and 1.0
    """
    if len(pcm_data) == 0:
        return 0.0

    import array
    samples = array.array('h')  # signed short integer array
    samples.frombytes(pcm_data)

    sum_squares = sum(sample * sample for sample in samples)
    rms = (sum_squares / len(samples)) ** 0.5

    # Normalize RMS to 0.0-1.0 range (for 16-bit audio, max value is 32767)
    normalized_rms = rms / 32767.0
    return normalized_rms