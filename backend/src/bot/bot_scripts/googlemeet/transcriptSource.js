'use strict';

// Mirrors msteams/transcriptSource.js so both bots share a vocabulary
// for "where do transcripts come from on this platform".
//
//   audio_asr      (default) capture per-peer audio receivers and run
//                  them through AWS Transcribe Streaming / Azure Speech
//                  Streaming. Best accuracy, costs ~$1.44/h on AWS.
//   gmeet_captions scrape Google Meet's built-in live captions from the
//                  DOM. Free; quality depends on Google's ASR (~82%
//                  accuracy per Recall.ai); requires captions to be
//                  enabled (the bot does this itself, no host action).
//
// Selection precedence (first non-empty wins):
//   1. options.captureMode passed to joinMeeting()
//   2. GOOGLEMEET_TRANSCRIPT_SOURCE env
//   3. (fallback alias) GOOGLEMEET_CAPTURE_MODE env
//   4. 'audio_asr'

const TRANSCRIPT_SOURCE = Object.freeze({
  AUDIO_ASR: 'audio_asr',
  GMEET_CAPTIONS: 'gmeet_captions',
});

const CAPTION_ALIASES = new Set([
  'gmeet_captions', 'gmeet_caption', 'google_meet_captions',
  'captions', 'caption', 'closed_captions', 'cc',
]);

const ASR_ALIASES = new Set([
  'audio_asr', 'asr', 'audio', 'streaming', 'aws', 'azure',
]);

function normalizeTranscriptSource(raw) {
  const candidates = [
    raw,
    process.env.GOOGLEMEET_TRANSCRIPT_SOURCE,
    process.env.GOOGLEMEET_CAPTURE_MODE,
  ];
  for (const c of candidates) {
    if (typeof c !== 'string') continue;
    const v = c.trim().toLowerCase();
    if (CAPTION_ALIASES.has(v)) return TRANSCRIPT_SOURCE.GMEET_CAPTIONS;
    if (ASR_ALIASES.has(v)) return TRANSCRIPT_SOURCE.AUDIO_ASR;
  }
  return TRANSCRIPT_SOURCE.AUDIO_ASR;
}

module.exports = { TRANSCRIPT_SOURCE, normalizeTranscriptSource };
