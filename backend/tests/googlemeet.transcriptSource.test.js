'use strict';

// Tests for googlemeet/transcriptSource.js — symmetric with the
// asrProvider helper. Verifies env-precedence, alias normalization,
// and backward-compat with the GOOGLEMEET_CAPTURE_MODE alias.

const path = require('node:path');
const {
  TRANSCRIPT_SOURCE, normalizeTranscriptSource,
} = require(path.join('..', 'src', 'bot', 'bot_scripts', 'googlemeet', 'transcriptSource'));

describe('googlemeet/transcriptSource', () => {
  const ENV = { ...process.env };
  afterEach(() => { process.env = { ...ENV }; });

  test('default is audio_asr', () => {
    delete process.env.GOOGLEMEET_TRANSCRIPT_SOURCE;
    delete process.env.GOOGLEMEET_CAPTURE_MODE;
    expect(normalizeTranscriptSource()).toBe(TRANSCRIPT_SOURCE.AUDIO_ASR);
  });

  test('explicit option wins over env', () => {
    process.env.GOOGLEMEET_TRANSCRIPT_SOURCE = 'gmeet_captions';
    expect(normalizeTranscriptSource('audio_asr')).toBe(TRANSCRIPT_SOURCE.AUDIO_ASR);
  });

  test('GOOGLEMEET_TRANSCRIPT_SOURCE env switches modes', () => {
    delete process.env.GOOGLEMEET_CAPTURE_MODE;
    process.env.GOOGLEMEET_TRANSCRIPT_SOURCE = 'gmeet_captions';
    expect(normalizeTranscriptSource()).toBe(TRANSCRIPT_SOURCE.GMEET_CAPTIONS);
  });

  test('GOOGLEMEET_CAPTURE_MODE backward-compat alias', () => {
    delete process.env.GOOGLEMEET_TRANSCRIPT_SOURCE;
    process.env.GOOGLEMEET_CAPTURE_MODE = 'captions';
    expect(normalizeTranscriptSource()).toBe(TRANSCRIPT_SOURCE.GMEET_CAPTIONS);
  });

  test.each([
    'captions', 'caption', 'closed_captions', 'cc',
    'GMEET_CAPTIONS', 'Captions',  // case-insensitive
  ])('alias "%s" normalizes to gmeet_captions', (val) => {
    expect(normalizeTranscriptSource(val)).toBe(TRANSCRIPT_SOURCE.GMEET_CAPTIONS);
  });

  test.each([
    'audio', 'asr', 'audio_asr', 'streaming', 'aws',
  ])('alias "%s" normalizes to audio_asr', (val) => {
    expect(normalizeTranscriptSource(val)).toBe(TRANSCRIPT_SOURCE.AUDIO_ASR);
  });

  test('unknown values fall back to default', () => {
    expect(normalizeTranscriptSource('whisper')).toBe(TRANSCRIPT_SOURCE.AUDIO_ASR);
    expect(normalizeTranscriptSource('')).toBe(TRANSCRIPT_SOURCE.AUDIO_ASR);
    expect(normalizeTranscriptSource(null)).toBe(TRANSCRIPT_SOURCE.AUDIO_ASR);
  });
});
