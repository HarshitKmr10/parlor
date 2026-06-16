"""
Multi-Provider Transcription Service
Python equivalent of transcribeProcessor.js

Supports multiple transcription providers:
- OpenAI Whisper
- Azure OpenAI Whisper
- AWS Transcribe
- AWS HealthScribe
- Amazon Bedrock Nova Sonic
- Local Whisper (faster-whisper — keyless, offline, no cloud)

Local Whisper (LLM_PROVIDER=local_whisper):
- Runs whisper locally via the optional `faster-whisper` package. No cloud
  account or API key required. The model (default "tiny") downloads on
  first use and is cached on disk, then runs fully offline.
- WHISPER_MODEL selects the model size ("tiny" default, also "tiny.en",
  "base", etc.). Cache dir honors HF_HOME / TRANSFORMERS_CACHE.
- faster-whisper is an OPTIONAL dependency so the image only installs it
  when needed. If the library/model is missing we return a clear error
  result instead of crashing the service.
"""

import asyncio
import json
import logging
import os
import tempfile
from enum import Enum
from typing import Any, Dict, List, Optional, Union
import uuid
from datetime import datetime
import base64

logger = logging.getLogger(__name__)


class TranscriptionProvider(Enum):
    OPENAI = "openai"
    AZURE_OPENAI = "azure_openai"
    AWS_TRANSCRIBE = "aws_transcribe"
    AWS_HEALTHSCRIBE = "healthscribe"
    BEDROCK_NOVA = "bedrock_nova"
    LOCAL_WHISPER = "local_whisper"


class TranscriptionResult:
    def __init__(self,
                 text: str,
                 segments: Optional[List[Dict[str, Any]]] = None,
                 speaker_id: Optional[str] = None,
                 speaker_name: Optional[str] = None,
                 timestamp: Optional[str] = None,
                 confidence: Optional[float] = None,
                 provider: Optional[str] = None):
        self.text = text
        self.segments = segments or []
        self.speaker_id = speaker_id
        self.speaker_name = speaker_name
        self.timestamp = timestamp or datetime.utcnow().isoformat()
        self.confidence = confidence
        self.provider = provider

    def to_dict(self) -> Dict[str, Any]:
        return {
            "text": self.text,
            "segments": self.segments,
            "speaker_id": self.speaker_id,
            "speaker_name": self.speaker_name,
            "timestamp": self.timestamp,
            "confidence": self.confidence,
            "provider": self.provider
        }

    def to_transcribe_processor_format(self) -> Dict[str, Any]:
        """Convert to transcribeProcessor.js compatible format"""
        return {
            "text": self.text,
            "segments": self.segments
        }


class TranscribeService:
    """Multi-provider transcription service"""

    def __init__(self):
        self.provider = self._determine_provider()
        self._init_provider()

    def _determine_provider(self) -> TranscriptionProvider:
        """Determine which provider to use based on environment variables"""
        provider = os.environ.get('LLM_PROVIDER', 'openai').lower()

        if provider == 'local_whisper':
            return TranscriptionProvider.LOCAL_WHISPER
        elif provider == 'healthscribe':
            return TranscriptionProvider.AWS_HEALTHSCRIBE
        elif provider == 'aws_transcribe':
            return TranscriptionProvider.AWS_TRANSCRIBE
        elif provider == 'bedrock_nova':
            return TranscriptionProvider.BEDROCK_NOVA
        elif provider == 'azure_openai':
            return TranscriptionProvider.AZURE_OPENAI
        else:
            return TranscriptionProvider.OPENAI

    def _init_provider(self):
        """Initialize the selected provider"""
        logger.info(f"Initializing transcription provider: {self.provider.value}")

        if self.provider == TranscriptionProvider.OPENAI:
            self._init_openai()
        elif self.provider == TranscriptionProvider.AZURE_OPENAI:
            self._init_azure_openai()
        elif self.provider == TranscriptionProvider.AWS_TRANSCRIBE:
            self._init_aws_transcribe()
        elif self.provider == TranscriptionProvider.AWS_HEALTHSCRIBE:
            self._init_aws_healthscribe()
        elif self.provider == TranscriptionProvider.BEDROCK_NOVA:
            self._init_bedrock_nova()
        elif self.provider == TranscriptionProvider.LOCAL_WHISPER:
            self._init_local_whisper()

    def _init_openai(self):
        """Initialize OpenAI provider"""
        try:
            from openai import OpenAI
            api_key = os.environ.get('OPENAI_API_KEY')
            if not api_key:
                raise ValueError("OPENAI_API_KEY not found in environment")
            self.client = OpenAI(api_key=api_key)
            logger.info("OpenAI Whisper client initialized")
        except ImportError:
            logger.error("OpenAI library not installed. Run: pip install openai")
            raise
        except Exception as e:
            logger.error(f"Failed to initialize OpenAI client: {e}")
            raise

    def _init_azure_openai(self):
        """Initialize Azure OpenAI provider"""
        try:
            from openai import AzureOpenAI
            api_key = os.environ.get('AZURE_OPENAI_API_KEY')
            endpoint = os.environ.get('AZURE_OPENAI_ENDPOINT')
            api_version = os.environ.get('AZURE_OPENAI_API_VERSION', '2024-08-01-preview')

            if not api_key or not endpoint:
                raise ValueError("AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT required")

            self.client = AzureOpenAI(
                api_key=api_key,
                api_version=api_version,
                azure_endpoint=endpoint
            )
            self.deployment = os.environ.get('AZURE_OPENAI_DEPLOYMENT', 'whisper-1')
            logger.info("Azure OpenAI Whisper client initialized")
        except ImportError:
            logger.error("OpenAI library not installed. Run: pip install openai")
            raise
        except Exception as e:
            logger.error(f"Failed to initialize Azure OpenAI client: {e}")
            raise

    def _init_aws_transcribe(self):
        """Initialize AWS Transcribe provider"""
        try:
            import boto3
            self.transcribe_client = boto3.client('transcribe')
            self.s3_client = boto3.client('s3')
            self.bucket_name = os.environ.get('S3_BUCKET_NAME')
            if not self.bucket_name:
                raise ValueError("S3_BUCKET_NAME required for AWS Transcribe")
            logger.info("AWS Transcribe client initialized")
        except ImportError:
            logger.error("Boto3 library not installed. Run: pip install boto3")
            raise
        except Exception as e:
            logger.error(f"Failed to initialize AWS Transcribe client: {e}")
            raise

    def _init_aws_healthscribe(self):
        """Initialize AWS HealthScribe provider"""
        try:
            import boto3
            self.healthscribe_client = boto3.client('transcribe')
            self.s3_client = boto3.client('s3')
            self.bucket_name = os.environ.get('S3_BUCKET_NAME')
            self.account_id = os.environ.get('AWS_ACCOUNT_ID')
            self.role_arn = os.environ.get('HEALTHSCRIBE_DATA_ACCESS_ROLE_ARN')

            if not self.bucket_name:
                raise ValueError("S3_BUCKET_NAME required for HealthScribe")

            # Auto-generate role ARN if not provided
            if not self.role_arn and self.account_id:
                role_name = os.environ.get('HEALTHSCRIBE_ROLE_NAME', 'HealthScribeDataAccessRole')
                self.role_arn = f"arn:aws:iam::{self.account_id}:role/{role_name}"

            logger.info("AWS HealthScribe client initialized")
        except ImportError:
            logger.error("Boto3 library not installed. Run: pip install boto3")
            raise
        except Exception as e:
            logger.error(f"Failed to initialize AWS HealthScribe client: {e}")
            raise

    def _init_bedrock_nova(self):
        """Initialize Amazon Bedrock Nova Sonic provider"""
        try:
            import boto3
            self.bedrock_client = boto3.client('bedrock-runtime')
            logger.info("Amazon Bedrock Nova Sonic client initialized")
        except ImportError:
            logger.error("Boto3 library not installed. Run: pip install boto3")
            raise
        except Exception as e:
            logger.error(f"Failed to initialize Bedrock client: {e}")
            raise

    def _init_local_whisper(self):
        """Initialize local Whisper (faster-whisper).

        Optional dependency: the model is lazy-loaded on first transcription
        so startup is not blocked by the first-run download. We only record
        the configured model size here. Missing library/model is surfaced as
        a clear error at transcription time, not a crash on init.
        """
        self.whisper_model_size = os.environ.get('WHISPER_MODEL', 'tiny')
        self._whisper_model = None  # lazy-loaded faster-whisper WhisperModel
        logger.info(
            "Local Whisper provider selected (model: %s) — keyless, offline. "
            "faster-whisper loads on first chunk.",
            self.whisper_model_size,
        )

    def _get_whisper_model(self):
        """Lazily load and cache the faster-whisper model."""
        if self._whisper_model is not None:
            return self._whisper_model
        try:
            from faster_whisper import WhisperModel
        except ImportError as e:
            raise RuntimeError(
                "faster-whisper is required for the local_whisper provider but is "
                "not installed. Install it with: pip install faster-whisper"
            ) from e

        compute_type = os.environ.get('WHISPER_COMPUTE_TYPE', 'int8')
        logger.info(
            "Loading faster-whisper model '%s' (compute_type=%s) — first run downloads the model...",
            self.whisper_model_size,
            compute_type,
        )
        self._whisper_model = WhisperModel(self.whisper_model_size, device="cpu", compute_type=compute_type)
        logger.info("Local Whisper model '%s' ready (offline, keyless)", self.whisper_model_size)
        return self._whisper_model

    async def transcribe_audio(self,
                               audio_data: bytes,
                               speaker_id: Optional[str] = None,
                               speaker_name: Optional[str] = None) -> Optional[TranscriptionResult]:
        """Transcribe audio using the configured provider"""
        try:
            if self.provider == TranscriptionProvider.OPENAI:
                return await self._transcribe_openai(audio_data, speaker_id, speaker_name)
            elif self.provider == TranscriptionProvider.AZURE_OPENAI:
                return await self._transcribe_azure_openai(audio_data, speaker_id, speaker_name)
            elif self.provider == TranscriptionProvider.AWS_TRANSCRIBE:
                return await self._transcribe_aws(audio_data, speaker_id, speaker_name)
            elif self.provider == TranscriptionProvider.AWS_HEALTHSCRIBE:
                return await self._transcribe_healthscribe(audio_data, speaker_id, speaker_name)
            elif self.provider == TranscriptionProvider.BEDROCK_NOVA:
                return await self._transcribe_bedrock_nova(audio_data, speaker_id, speaker_name)
            elif self.provider == TranscriptionProvider.LOCAL_WHISPER:
                return await self._transcribe_local_whisper(audio_data, speaker_id, speaker_name)
            else:
                logger.error(f"Unsupported provider: {self.provider}")
                return None

        except Exception as e:
            logger.error(f"Transcription failed with {self.provider.value}: {e}")
            return None

    async def _transcribe_openai(self, audio_data: bytes, speaker_id: str, speaker_name: str) -> TranscriptionResult:
        """Transcribe using OpenAI Whisper"""
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
            temp_file.write(audio_data)
            temp_file.flush()

            try:
                with open(temp_file.name, 'rb') as audio_file:
                    response = self.client.audio.transcriptions.create(
                        model="whisper-1",
                        file=audio_file,
                        response_format="verbose_json",
                        timestamp_granularities=["word", "segment"]
                    )

                # Convert segments to transcribeProcessor format
                segments = []
                if hasattr(response, 'segments') and response.segments:
                    segments = [
                        {
                            "start": segment.start,
                            "end": segment.end,
                            "text": segment.text,
                            "speaker": speaker_name or f"Speaker_{speaker_id}"
                        }
                        for segment in response.segments
                    ]

                return TranscriptionResult(
                    text=response.text.strip(),
                    segments=segments,
                    speaker_id=speaker_id,
                    speaker_name=speaker_name,
                    provider="openai"
                )
            finally:
                os.unlink(temp_file.name)

    async def _transcribe_azure_openai(self, audio_data: bytes, speaker_id: str, speaker_name: str) -> TranscriptionResult:
        """Transcribe using Azure OpenAI Whisper"""
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
            temp_file.write(audio_data)
            temp_file.flush()

            try:
                with open(temp_file.name, 'rb') as audio_file:
                    response = self.client.audio.transcriptions.create(
                        model=self.deployment,
                        file=audio_file,
                        response_format="verbose_json",
                        timestamp_granularities=["word", "segment"]
                    )

                # Convert segments to transcribeProcessor format
                segments = []
                if hasattr(response, 'segments') and response.segments:
                    segments = [
                        {
                            "start": segment.start,
                            "end": segment.end,
                            "text": segment.text,
                            "speaker": speaker_name or f"Speaker_{speaker_id}"
                        }
                        for segment in response.segments
                    ]

                return TranscriptionResult(
                    text=response.text.strip(),
                    segments=segments,
                    speaker_id=speaker_id,
                    speaker_name=speaker_name,
                    provider="azure_openai"
                )
            finally:
                os.unlink(temp_file.name)

    async def _transcribe_aws(self, audio_data: bytes, speaker_id: str, speaker_name: str) -> TranscriptionResult:
        """Transcribe using AWS Transcribe"""
        try:
            import boto3
            from botocore.exceptions import ClientError, BotoCoreError

            # Create unique job name
            job_name = f"transcription-{uuid.uuid4()}"
            s3_key = f"audio/{job_name}.wav"
            s3_uri = f"s3://{self.bucket_name}/{s3_key}"

            # Upload audio to S3
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
                temp_file.write(audio_data)
                temp_file.flush()

                try:
                    self.s3_client.upload_file(temp_file.name, self.bucket_name, s3_key)
                    logger.info(f"Uploaded audio to {s3_uri}")
                finally:
                    os.unlink(temp_file.name)

            # Start transcription job
            transcription_job = {
                'TranscriptionJobName': job_name,
                'Media': {'MediaFileUri': s3_uri},
                'MediaFormat': 'wav',
                'LanguageCode': os.environ.get('TRANSCRIPTION_LANGUAGE', 'en-US'),
                'Settings': {
                    'ShowSpeakerLabels': True,
                    'MaxSpeakerLabels': 10,
                    'ShowAlternatives': False
                }
            }

            response = self.transcribe_client.start_transcription_job(**transcription_job)
            logger.info(f"Started transcription job: {job_name}")

            # Wait for completion (polling)
            while True:
                result = self.transcribe_client.get_transcription_job(
                    TranscriptionJobName=job_name
                )

                status = result['TranscriptionJob']['TranscriptionJobStatus']

                if status == 'COMPLETED':
                    transcript_uri = result['TranscriptionJob']['Transcript']['TranscriptFileUri']

                    # Download and parse transcript
                    import requests
                    transcript_response = requests.get(transcript_uri)
                    transcript_data = transcript_response.json()

                    # Format result
                    full_text = transcript_data['results']['transcripts'][0]['transcript']
                    segments = self._format_aws_segments(transcript_data, speaker_name, speaker_id)

                    # Cleanup S3 object
                    try:
                        self.s3_client.delete_object(Bucket=self.bucket_name, Key=s3_key)
                    except:
                        pass

                    return TranscriptionResult(
                        text=full_text,
                        segments=segments,
                        speaker_id=speaker_id,
                        speaker_name=speaker_name,
                        provider="aws_transcribe"
                    )

                elif status == 'FAILED':
                    failure_reason = result['TranscriptionJob'].get('FailureReason', 'Unknown error')
                    raise Exception(f"AWS Transcribe job failed: {failure_reason}")

                # Wait before polling again
                await asyncio.sleep(2)

        except Exception as e:
            logger.error(f"AWS Transcribe error: {e}")
            return TranscriptionResult(
                text="[AWS Transcribe error]",
                segments=[],
                speaker_id=speaker_id,
                speaker_name=speaker_name,
                provider="aws_transcribe"
            )

    async def _transcribe_healthscribe(self, audio_data: bytes, speaker_id: str, speaker_name: str) -> TranscriptionResult:
        """Transcribe using AWS HealthScribe"""
        try:
            import boto3
            from botocore.exceptions import ClientError, BotoCoreError

            # Create unique job name
            job_name = f"healthscribe-{uuid.uuid4()}"
            s3_key = f"audio/{job_name}.wav"
            s3_uri = f"s3://{self.bucket_name}/{s3_key}"

            # Upload audio to S3
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
                temp_file.write(audio_data)
                temp_file.flush()

                try:
                    self.s3_client.upload_file(temp_file.name, self.bucket_name, s3_key)
                    logger.info(f"Uploaded audio to {s3_uri} for HealthScribe")
                finally:
                    os.unlink(temp_file.name)

            # Start HealthScribe job
            scribe_job = {
                'MedicalScribeJobName': job_name,
                'Media': {'MediaFileUri': s3_uri},
                'OutputBucketName': self.bucket_name,
                'OutputEncryptionKMSKeyId': os.environ.get('HEALTHSCRIBE_KMS_KEY_ID'),
                'DataAccessRoleArn': self.role_arn,
                'Settings': {
                    'ShowSpeakerLabels': True,
                    'MaxSpeakerLabels': 10,
                    'ChannelIdentification': False,
                    'VocabularyName': os.environ.get('HEALTHSCRIBE_VOCABULARY_NAME'),
                    'VocabularyFilterName': os.environ.get('HEALTHSCRIBE_VOCABULARY_FILTER_NAME')
                }
            }

            # Remove None values
            scribe_job = {k: v for k, v in scribe_job.items() if v is not None}
            if 'Settings' in scribe_job:
                scribe_job['Settings'] = {k: v for k, v in scribe_job['Settings'].items() if v is not None}

            response = self.healthscribe_client.start_medical_scribe_job(**scribe_job)
            logger.info(f"Started HealthScribe job: {job_name}")

            # Wait for completion (polling)
            while True:
                result = self.healthscribe_client.get_medical_scribe_job(
                    MedicalScribeJobName=job_name
                )

                status = result['MedicalScribeJob']['MedicalScribeJobStatus']

                if status == 'COMPLETED':
                    output_location = result['MedicalScribeJob']['MedicalScribeOutput']
                    transcript_uri = output_location.get('TranscriptFileUri')

                    # Download and parse transcript
                    import requests
                    transcript_response = requests.get(transcript_uri)
                    healthscribe_data = transcript_response.json()

                    # Format result - use transcript portion like regular transcription
                    transcript_results = healthscribe_data.get('transcript', {}).get('Results', {})
                    full_text = ''
                    if transcript_results.get('Transcripts'):
                        full_text = transcript_results['Transcripts'][0].get('Content', '')

                    segments = self._format_healthscribe_segments(healthscribe_data, speaker_name, speaker_id)

                    # Cleanup S3 object
                    try:
                        self.s3_client.delete_object(Bucket=self.bucket_name, Key=s3_key)
                    except:
                        pass

                    return TranscriptionResult(
                        text=full_text,
                        segments=segments,
                        speaker_id=speaker_id,
                        speaker_name=speaker_name,
                        provider="healthscribe"
                    )

                elif status == 'FAILED':
                    failure_reason = result['MedicalScribeJob'].get('FailureReason', 'Unknown error')
                    raise Exception(f"AWS HealthScribe job failed: {failure_reason}")

                # Wait before polling again
                await asyncio.sleep(2)

        except Exception as e:
            logger.error(f"AWS HealthScribe error: {e}")
            return TranscriptionResult(
                text="[AWS HealthScribe error]",
                segments=[],
                speaker_id=speaker_id,
                speaker_name=speaker_name,
                provider="healthscribe"
            )

    async def _transcribe_bedrock_nova(self, audio_data: bytes, speaker_id: str, speaker_name: str) -> TranscriptionResult:
        """Transcribe using Amazon Bedrock Nova Sonic"""
        try:
            # Encode audio data to base64
            audio_base64 = base64.b64encode(audio_data).decode('utf-8')

            # Prepare the request
            request_body = {
                "inputData": {
                    "format": "wav",
                    "data": audio_base64
                },
                "outputConfig": {
                    "format": "text"
                }
            }

            # Call Bedrock Nova Sonic model
            response = self.bedrock_client.invoke_model(
                modelId="amazon.bedrock-nova-sonic-v1",
                body=json.dumps(request_body),
                contentType="application/json"
            )

            # Parse response
            response_body = json.loads(response['body'].read())
            text = response_body.get('outputData', {}).get('text', '')

            segments = []
            if text:
                # Create a single segment since Nova Sonic doesn't provide detailed timing
                segments = [{
                    "start": 0,
                    "end": len(audio_data) / 32000,  # Estimate duration based on sample rate
                    "text": text,
                    "speaker": speaker_name or f"Speaker_{speaker_id}"
                }]

            return TranscriptionResult(
                text=text,
                segments=segments,
                speaker_id=speaker_id,
                speaker_name=speaker_name,
                provider="bedrock_nova"
            )

        except Exception as e:
            logger.error(f"Bedrock Nova Sonic error: {e}")
            return TranscriptionResult(
                text="[Bedrock Nova Sonic error]",
                segments=[],
                speaker_id=speaker_id,
                speaker_name=speaker_name,
                provider="bedrock_nova"
            )

    async def _transcribe_local_whisper(self, audio_data: bytes, speaker_id: str, speaker_name: str) -> TranscriptionResult:
        """Transcribe locally with faster-whisper (keyless, offline).

        Produces the same { text, segments: [{ start, end, text, speaker }] }
        shape as the other providers. Library/model failures return a clear
        error result rather than crashing the caller.
        """
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
            temp_file.write(audio_data)
            temp_file.flush()
            temp_path = temp_file.name

        try:
            model = self._get_whisper_model()
            language = os.environ.get('TRANSCRIPTION_LANGUAGE')
            # Normalize locale (e.g. en-US) to a short code faster-whisper accepts.
            if language:
                language = language.split('-')[0].lower()

            # faster-whisper is synchronous; run it off the event loop.
            def _run():
                segments_iter, _info = model.transcribe(temp_path, language=language)
                return list(segments_iter)

            raw_segments = await asyncio.to_thread(_run)

            speaker = speaker_name or (f"Speaker_{speaker_id}" if speaker_id else "Unknown")
            segments = [
                {
                    "start": float(seg.start),
                    "end": float(seg.end),
                    "text": seg.text.strip(),
                    "speaker": speaker,
                }
                for seg in raw_segments
                if seg.text and seg.text.strip()
            ]
            full_text = ' '.join(s["text"] for s in segments).strip()

            return TranscriptionResult(
                text=full_text,
                segments=segments,
                speaker_id=speaker_id,
                speaker_name=speaker_name,
                provider="local_whisper",
            )
        except Exception as e:
            logger.error(f"Local Whisper error: {e}")
            return TranscriptionResult(
                text="[Local Whisper error: ensure faster-whisper is installed]",
                segments=[],
                speaker_id=speaker_id,
                speaker_name=speaker_name,
                provider="local_whisper",
            )
        finally:
            try:
                os.unlink(temp_path)
            except OSError:
                pass

    def _format_aws_segments(self, transcript_data: dict, speaker_name: str, speaker_id: str) -> List[Dict[str, Any]]:
        """Format AWS Transcribe segments to match transcribeProcessor format"""
        segments = []

        try:
            items = transcript_data['results']['items']
            speaker_labels = transcript_data['results'].get('speaker_labels', {}).get('segments', [])

            for speaker_segment in speaker_labels:
                segment_items = speaker_segment.get('items', [])
                if not segment_items:
                    continue

                # Extract text and timing
                start_time = float(segment_items[0].get('start_time', 0))
                end_time = float(segment_items[-1].get('end_time', 0))

                # Build text from items
                text_parts = []
                for item in segment_items:
                    # Find corresponding item in results
                    for result_item in items:
                        if (result_item.get('start_time') == item.get('start_time') and
                            result_item.get('type') == 'pronunciation'):
                            if result_item.get('alternatives'):
                                text_parts.append(result_item['alternatives'][0]['content'])
                            break

                text = ' '.join(text_parts).strip()
                if text:
                    segments.append({
                        "start": start_time,
                        "end": end_time,
                        "text": text,
                        "speaker": f"Speaker_{speaker_segment.get('speaker_label', 'Unknown')}"
                    })

        except Exception as e:
            logger.error(f"Error formatting AWS segments: {e}")

        return segments

    def _format_healthscribe_segments(self, healthscribe_data: dict, speaker_name: str, speaker_id: str) -> List[Dict[str, Any]]:
        """Format AWS HealthScribe segments to match transcribeProcessor format"""
        segments = []

        try:
            transcript_results = healthscribe_data.get('transcript', {}).get('Results', {})
            items = transcript_results.get('Items', [])

            current_segment = {"text": "", "start": 0, "end": 0, "speaker": "Unknown"}

            for item in items:
                if item.get('Type') == 'pronunciation' and item.get('Alternatives'):
                    content = item['Alternatives'][0].get('Content', '')
                    start_time = float(item.get('StartTime', 0))
                    end_time = float(item.get('EndTime', 0))

                    # Simple speaker identification (Speaker_0, Speaker_1, etc.)
                    speaker = f"Speaker_{item.get('Speaker', 'Unknown')}" if item.get('Speaker') else 'Unknown'

                    # Check if this continues the current segment
                    if current_segment['speaker'] == speaker and end_time - current_segment['end'] < 2:
                        current_segment['text'] += ' ' + content
                        current_segment['end'] = end_time
                    else:
                        # Save current segment if it has content
                        if current_segment['text'].strip():
                            segments.append({
                                "start": current_segment['start'],
                                "end": current_segment['end'],
                                "text": current_segment['text'].strip(),
                                "speaker": current_segment['speaker']
                            })

                        # Start new segment
                        current_segment = {
                            "text": content,
                            "start": start_time,
                            "end": end_time,
                            "speaker": speaker
                        }

            # Add final segment
            if current_segment['text'].strip():
                segments.append({
                    "start": current_segment['start'],
                    "end": current_segment['end'],
                    "text": current_segment['text'].strip(),
                    "speaker": current_segment['speaker']
                })

        except Exception as e:
            logger.error(f"Error formatting HealthScribe segments: {e}")

        return segments