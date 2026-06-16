'use strict';

// Provider-agnostic transcription adapter.
//
// Delegates to the project's MultiProviderTranscriber, which already supports
// the full set of providers selected via LLM_PROVIDER:
//   - openai
//   - azure_openai
//   - azure_speech
//   - aws_transcribe
//   - aws_transcribe_medical
//   - bedrock        (Nova Sonic)
//   - healthscribe
//
// We do not re-implement any of those here; the goal is to expose a small
// async transcribe(wavPath, { startOffsetSec, prompt? }) that returns a
// normalised shape so the capture bridge stays provider-agnostic.

const path = require('node:path');
const fs = require('node:fs/promises');

let MultiProviderTranscriber;
try {
  ({ MultiProviderTranscriber } = require('../../../processors/transcribeProcessor'));
} catch (err) {
  // Fall back to lazy require so unit tests can stub this module without
  // pulling the entire transcription stack into the require graph.
  MultiProviderTranscriber = null;
}

const RESULT_KIND = Object.freeze({
  WORDS: 'words',          // verbose_json with word-level timestamps (OpenAI/Azure/AWS)
  SEGMENTS: 'segments',    // segment-only granularity (Bedrock, HealthScribe)
  EMPTY: 'empty',
});

class TranscriptionAdapter {
  constructor({ logger, transcriber } = {}) {
    this.logger = logger || console;
    if (transcriber) {
      this.transcriber = transcriber;
    } else {
      if (!MultiProviderTranscriber) {
        ({ MultiProviderTranscriber } = require('../../../processors/transcribeProcessor'));
      }
      this.transcriber = new MultiProviderTranscriber();
    }
    this.providerName = this.transcriber.provider || process.env.LLM_PROVIDER || 'openai';
  }

  // wavPath: absolute path to a 16 kHz mono PCM16 WAV file.
  // startOffsetSec: seconds to add to all timestamps so they are wall-clock
  //   anchored relative to the meeting start.
  async transcribe(wavPath, { startOffsetSec = 0 } = {}) {
    const exists = await fs.stat(wavPath).then(() => true).catch(() => false);
    if (!exists) return { kind: RESULT_KIND.EMPTY, text: '', words: [], segments: [], language: null };

    let raw;
    try {
      raw = await this.transcriber.transcribeChunk(wavPath, startOffsetSec);
    } catch (err) {
      this.logger.warn?.('[teams.transcribe] provider error', { provider: this.providerName, err: err?.message });
      throw err;
    }
    return normaliseResult(raw, startOffsetSec);
  }
}

function normaliseResult(raw, startOffsetSec) {
  if (!raw || typeof raw !== 'object') {
    return { kind: RESULT_KIND.EMPTY, text: '', words: [], segments: [], language: null };
  }

  const text = String(raw.text || '').trim();
  if (!text) {
    return { kind: RESULT_KIND.EMPTY, text: '', words: [], segments: [], language: raw.language || null };
  }

  const segments = Array.isArray(raw.segments) ? raw.segments.map((s) => ({
    start: Number(s.start) || 0,
    end: Number(s.end) || 0,
    text: String(s.text || '').trim(),
    words: Array.isArray(s.words) ? s.words.map((w) => normaliseWord(w)) : null,
  })) : [];

  // Some providers attach words at the top level; others attach them per
  // segment; some don't return words at all. Flatten if available.
  let words = [];
  if (Array.isArray(raw.words) && raw.words.length) {
    words = raw.words.map(normaliseWord);
  } else {
    for (const seg of segments) {
      if (Array.isArray(seg.words) && seg.words.length) words.push(...seg.words);
    }
  }

  // The MultiProviderTranscriber adjusts start/end by startOffsetSec internally
  // for most providers; defensively re-anchor anything that came back at zero
  // when offset is non-zero.
  if (startOffsetSec && segments.length && segments[0].end <= startOffsetSec) {
    for (const seg of segments) { seg.start += startOffsetSec; seg.end += startOffsetSec; }
    for (const w of words) { w.start += startOffsetSec; w.end += startOffsetSec; }
  }

  return {
    kind: words.length ? RESULT_KIND.WORDS : RESULT_KIND.SEGMENTS,
    text,
    words,
    segments,
    language: raw.language || null,
    raw,
  };
}

function normaliseWord(w) {
  return {
    word: String(w.word || w.text || '').trim(),
    start: Number(w.start) || 0,
    end: Number(w.end) || 0,
    probability: typeof w.probability === 'number' ? w.probability : null,
  };
}

module.exports = { TranscriptionAdapter, RESULT_KIND };
