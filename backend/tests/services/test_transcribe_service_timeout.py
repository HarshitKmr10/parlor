"""Regression test: transcript-result fetches must have an HTTP timeout.

`_transcribe_aws` and `_transcribe_healthscribe` download the AWS
Transcribe/HealthScribe result JSON from a pre-signed S3 URI via
`requests.get(transcript_uri)`. Without a timeout, a hung pre-signed-URL
fetch blocks the transcription pipeline indefinitely.
"""

from __future__ import annotations

import sys
from unittest.mock import MagicMock, patch

import pytest

from src.services.transcribe_service import TranscribeService

# boto3 is an optional dependency of this codebase (only needed for the AWS
# Transcribe/HealthScribe providers) and isn't installed in the test venv.
# Both methods under test do a local `import boto3` / `from botocore...
# import ...` before reaching the requests.get() call, so stub the modules
# in sys.modules for the duration of these tests.
_FAKE_MODULES = {
    "boto3": MagicMock(),
    "botocore": MagicMock(),
    "botocore.exceptions": MagicMock(ClientError=Exception, BotoCoreError=Exception),
}


def _make_service(**attrs) -> TranscribeService:
    # Bypass __init__ (it initializes a real provider client based on env
    # vars/credentials); wire up just the attributes these methods touch,
    # matching the DatabaseConnection.__new__ pattern used elsewhere in this
    # test suite for heavy-constructor classes.
    service = TranscribeService.__new__(TranscribeService)
    for name, value in attrs.items():
        setattr(service, name, value)
    return service


@pytest.mark.asyncio
async def test_transcribe_aws_fetches_transcript_with_timeout():
    transcribe_client = MagicMock()
    transcribe_client.start_transcription_job.return_value = {}
    transcribe_client.get_transcription_job.return_value = {
        "TranscriptionJob": {
            "TranscriptionJobStatus": "COMPLETED",
            "Transcript": {"TranscriptFileUri": "https://example.com/t.json"},
        }
    }
    s3_client = MagicMock()

    service = _make_service(
        transcribe_client=transcribe_client,
        s3_client=s3_client,
        bucket_name="test-bucket",
    )

    fake_response = MagicMock()
    fake_response.json.return_value = {
        "results": {"transcripts": [{"transcript": "hello world"}], "items": []}
    }

    with patch.dict(sys.modules, _FAKE_MODULES), patch(
        "requests.get", return_value=fake_response
    ) as get_mock:
        result = await service._transcribe_aws(b"audio-bytes", "spk-1", "Speaker One")

    get_mock.assert_called_once_with("https://example.com/t.json", timeout=30)
    assert result.text == "hello world"
    assert result.provider == "aws_transcribe"


@pytest.mark.asyncio
async def test_transcribe_healthscribe_fetches_transcript_with_timeout():
    healthscribe_client = MagicMock()
    healthscribe_client.start_medical_scribe_job.return_value = {}
    healthscribe_client.get_medical_scribe_job.return_value = {
        "MedicalScribeJob": {
            "MedicalScribeJobStatus": "COMPLETED",
            "MedicalScribeOutput": {"TranscriptFileUri": "https://example.com/h.json"},
        }
    }
    s3_client = MagicMock()

    service = _make_service(
        healthscribe_client=healthscribe_client,
        s3_client=s3_client,
        bucket_name="test-bucket",
        role_arn="arn:aws:iam::123456789012:role/fake",
    )

    fake_response = MagicMock()
    fake_response.json.return_value = {
        "transcript": {"Results": {"Transcripts": [{"Content": "hello scribe"}]}}
    }

    with patch.dict(sys.modules, _FAKE_MODULES), patch(
        "requests.get", return_value=fake_response
    ) as get_mock:
        result = await service._transcribe_healthscribe(
            b"audio-bytes", "spk-1", "Speaker One"
        )

    get_mock.assert_called_once_with("https://example.com/h.json", timeout=30)
    assert result.text == "hello scribe"
    assert result.provider == "healthscribe"
