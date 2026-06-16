'use strict';

// Azure Speech Streaming adapter. Uses microsoft-cognitiveservices-speech-sdk
// (already a dependency for batch transcription in transcribeProcessor.js).
//
// Drop-in alternative to AwsTranscribeAdapter for the per-participant pool.
// Same constructor surface and same emitted segment shape, so the pool
// (PerParticipantStreamPool) doesn't care which provider it gets.
//
// Notes:
//   - Audio fed via PushAudioInputStream at the configured sampleRate (PCM
//     16-bit mono). Pushing 48 kHz works the same as 16 kHz; we just declare
//     the rate in the AudioStreamFormat.
//   - Continuous recognition: `recognizing` events carry partials,
//     `recognized` events carry finals. Both fan out as segments; partials
//     have is_final=false.
//   - Word-level offsets come from the JSON detail blob attached to each
//     final result (PropertyId.SpeechServiceResponse_JsonResult). Offsets
//     are in 100 ns "ticks" — divide by 10_000 to get ms.
//   - Speaker diarization is intentionally not enabled. We're already
//     attributed per-participant upstream by the floor-owner pipeline, so
//     each session sees a single speaker. ConversationTranscriber would
//     re-diarize a single-speaker stream, which is wasted work.
//   - No heartbeat needed. The PushAudioInputStream tolerates idle gaps and
//     the SDK manages the websocket keep-alive itself.

const { Buffer } = require('node:buffer');
const sdk = require('microsoft-cognitiveservices-speech-sdk');
const { CsrcAudioDumpWriter } = require('../../csrcAttribution/CsrcAudioDumpWriter');
const { createAzureSpeechConfig } = require('../../azureSpeechAuth');

const TICKS_PER_MS = 10_000;
const DEFAULT_SEGMENTATION_SILENCE_TIMEOUT_MS = 300;

// Trailing-silence injection. When the floor-owner pipeline stops feeding
// audio (current speaker went silent),
// Azure's segmentation engine sits indefinitely on the last hypothesis — no
// `RecognizedSpeech` (final) ever fires because, from the SDK's view, the
// input stream simply paused. Pumping zero-byte PCM silence into the
// PushAudioInputStream gives the segmentation engine a silence boundary and
// forces it to finalize the in-flight utterance.
//
// Without this, partials grow unbounded into multi-turn fused hypotheses
// and nothing ever lands in the DB.
const TRAILING_SILENCE_AFTER_MS = 500;   // start injecting after this gap
const TRAILING_SILENCE_CHUNK_MS = 200;   // length of each silence chunk
const TRAILING_SILENCE_MAX_MS = 1500;    // stop injecting after this total gap
const TRAILING_SILENCE_TICK_MS = 100;    // how often we check for silence

class AzureSpeechAdapter {
  constructor({
    logger = console,
    sampleRate = 16_000,
    languageCode = 'en-US',
    onSegment = () => {},
    onError = () => {},
    onReady = () => {},
    onClose = () => {},
    meetingStartMs = Date.now(),
    meetingId = null,
    participantId = 'unknown',
    participantName = null,
  } = {}) {
    this.provider = 'azure_speech';
    this.logger = logger;
    this.sampleRate = sampleRate;
    this.languageCode = languageCode;
    this.onSegment = onSegment;
    this.onError = onError;
    this.onReady = onReady;
    this.onClose = onClose;
    this.meetingStartMs = meetingStartMs;
    this.meetingId = meetingId;
    this.participantId = participantId;
    this.participantName = participantName;
    // Azure-specific config is sourced exclusively from the AZURE_SPEECH_*
    // env vars. We do NOT accept these from the caller because the pool
    // passes a `region` field that is the AWS region (e.g. 'us-east-1') —
    // taking that as the Azure region produced an invalid endpoint host
    // (us-east-1.stt.speech.microsoft.com) and silently failed every WS
    // handshake.
    this.endpoint = process.env.AZURE_SPEECH_ENDPOINT;
    this.subscriptionKey = process.env.AZURE_SPEECH_KEY;
    this.region = process.env.AZURE_SPEECH_REGION;
    this.containerEndpoint = process.env.AZURE_SPEECH_CONTAINER_ENDPOINT;
    this.disableCrlCheck = process.env.AZURE_SPEECH_DISABLE_CRL_CHECK === 'true';
    this.segmentationSilenceTimeoutMs = Number(process.env.AZURE_SPEECH_SEGMENTATION_SILENCE_TIMEOUT_MS)
      || DEFAULT_SEGMENTATION_SILENCE_TIMEOUT_MS;
    this.lastError = null;
    this.sessionId = null;

    this._closing = false;
    this._started = false;
    this._pushStream = null;
    this._recognizer = null;
    // Frames received before startContinuousRecognitionAsync's success cb
    // fires. Pushing audio into the PushAudioInputStream during the
    // websocket handshake window has been observed to wedge the SDK
    // (ConnectingToServiceEvent fires but ConnectionEstablishedEvent never
    // does), so we hold frames here until the SDK confirms it's ready.
    this._internalQueue = [];

    // Diagnostics. Counters log periodically from pushFrame so we can see
    // whether audio reaches the SDK and what the recognizer is emitting.
    this._chunksSent = 0;
    this._bytesSent = 0;
    this._silenceChunksSent = 0;
    this._silenceBytesSent = 0;
    this._lastStatsLogMs = 0;
    this._eventCounts = {
      recognizing: 0, recognized: 0, no_match: 0, canceled: 0,
      session_started: 0, session_stopped: 0,
      speech_start: 0, speech_end: 0,
    };
    this._lastInterimLogMs = 0;

    // Trailing-silence pump. Updated on every real `pushFrame`. The interval
    // (started after `_started` flips true) checks every TICK_MS and pumps a
    // CHUNK_MS silence buffer into the SDK once the gap since the last real
    // audio frame is in [AFTER_MS, MAX_MS]. Outside that window we sit idle.
    this._lastRealAudioMs = 0;
    this._lastSilenceSentMs = 0;
    this._silenceTimer = null;
    this._audioDump = CsrcAudioDumpWriter.isEnabled()
      ? new CsrcAudioDumpWriter({
          logger: this.logger,
          sampleRate: this.sampleRate,
          participantId: this.participantId,
          participantName: this.participantName,
          provider: this.provider,
          meetingId: this.meetingId,
        })
      : null;
  }

  async connect() {
    const speechConfigDetails = this._buildSpeechConfig();
    const speechConfig = speechConfigDetails.config;
    speechConfig.speechRecognitionLanguage = this.languageCode;
    speechConfig.outputFormat = sdk.OutputFormat.Detailed;
    speechConfig.requestWordLevelTimestamps();
    speechConfig.setProperty(
      sdk.PropertyId.Speech_SegmentationSilenceTimeoutMs,
      String(this.segmentationSilenceTimeoutMs),
    );
    if (this.disableCrlCheck) {
      speechConfig.setProperty('OPENSSL_DISABLE_CRL_CHECK', 'true');
    }

    const format = sdk.AudioStreamFormat.getWaveFormatPCM(this.sampleRate, 16, 1);
    this._pushStream = sdk.AudioInputStream.createPushStream(format);
    const audioConfig = sdk.AudioConfig.fromStreamInput(this._pushStream);

    const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);
    this._recognizer = recognizer;

    // SDK transport trace, opt-in via AZURE_SPEECH_DEBUG=1. Set BEFORE the
    // recognizer is fully initialised so the trace catches connection setup.
    if (process.env.AZURE_SPEECH_DEBUG === '1') {
      sdk.Diagnostics.SetLoggingLevel(sdk.LogLevel.Debug);
    }

    recognizer.recognizing = (_s, e) => {
      this._eventCounts.recognizing += 1;
      const text = e?.result?.text || '';
      const now = Date.now();
      // Throttle interim logs to 1/2s so we don't drown the worker log.
      if (text && now - this._lastInterimLogMs >= 2000) {
        this._lastInterimLogMs = now;
        this.logger.info?.('[teams.azure] recognizing', {
          count: this._eventCounts.recognizing,
          text_len: text.length,
          preview: text.slice(0, 80),
        });
      }
      this._handleResult(e.result, /* isFinal */ false);
    };
    recognizer.recognized = (_s, e) => {
      this._eventCounts.recognized += 1;
      const result = e?.result;
      const reason = result?.reason;
      const text = result?.text || '';
      if (reason === sdk.ResultReason.NoMatch) {
        this._eventCounts.no_match += 1;
        let nmReason = null;
        try { nmReason = sdk.NoMatchDetails.fromResult(result).reason; } catch (_) {}
        this.logger.info?.('[teams.azure] no-match', {
          count: this._eventCounts.no_match,
          reason: nmReason,
          offset_ms: ticksToMs(result?.offset),
          duration_ms: ticksToMs(result?.duration),
        });
        return;
      }
      this.logger.info?.('[teams.azure] recognized', {
        count: this._eventCounts.recognized,
        reason,
        text_len: text.length,
        offset_ms: ticksToMs(result?.offset),
        duration_ms: ticksToMs(result?.duration),
        preview: text.slice(0, 120),
      });
      this._handleResult(result, /* isFinal */ true);
    };
    recognizer.canceled = (_s, e) => {
      this._eventCounts.canceled += 1;
      const reason = e.reason;
      const errorCode = e.errorCode;
      const errorDetails = e.errorDetails;
      const err = new Error(`azure speech canceled: reason=${reason} code=${errorCode} details=${errorDetails || 'none'}`);
      this.lastError = err;
      this.logger.warn?.('[teams.azure] canceled', { reason, errorCode, errorDetails });
      if (!this._closing) this.onClose(err);
    };
    recognizer.sessionStarted = (_s, e) => {
      this._eventCounts.session_started += 1;
      this.sessionId = e.sessionId || null;
      this.logger.info?.('[teams.azure] session started', { sessionId: this.sessionId });
    };
    recognizer.sessionStopped = (_s) => {
      this._eventCounts.session_stopped += 1;
      this.logger.info?.('[teams.azure] session stopped', {
        sessionId: this.sessionId, eventCounts: this._eventCounts,
      });
    };
    recognizer.speechStartDetected = () => {
      this._eventCounts.speech_start += 1;
      this.logger.info?.('[teams.azure] speech start', { count: this._eventCounts.speech_start });
    };
    recognizer.speechEndDetected = () => {
      this._eventCounts.speech_end += 1;
      this.logger.info?.('[teams.azure] speech end', { count: this._eventCounts.speech_end });
    };

    // Log the actual auth path taken by _buildSpeechConfig. Don't conflate
    // with which env var was set (region+key wins over endpoint when both
    // are present).
    this.logger.info?.('[teams.azure] connecting', {
      lang: this.languageCode,
      sampleRate: this.sampleRate,
      auth: speechConfigDetails.authMode,
      region: this.region || null,
    });

    // Kick off start_continuous_recognition. We fire onReady *immediately*
    // so the upstream pool can drain its pendingFrames into our pushFrame
    // — but pushFrame routes those frames into an internal queue (not the
    // SDK's pushStream) until the success callback fires. Pushing audio
    // into the SDK during its websocket handshake has been observed to
    // wedge the connection: ConnectingToServiceEvent fires, the audio
    // pipeline gets attached, but ConnectionEstablishedEvent never fires
    // and no recognition happens. Mirroring the documented pattern (push
    // audio only after start_continuous_recognition success) avoids that
    // race.
    recognizer.startContinuousRecognitionAsync(
      () => {
        this._started = true;
        const drained = this._internalQueue.length;
        this.logger.info?.('[teams.azure] start_continuous_recognition success', {
          queued_frames: drained,
        });
        for (const buf of this._internalQueue) this._writeToStream(buf);
        this._internalQueue.length = 0;
        this._startSilencePump();
      },
      (err) => {
        this.lastError = err;
        this.logger.warn?.('[teams.azure] start_continuous_recognition failed', { err: err?.message || String(err) });
        if (!this._closing) this.onClose(err instanceof Error ? err : new Error(String(err)));
      },
    );
    this.logger.info?.('[teams.azure] recognizer wired, ready for frames');
    try { this.onReady(); }
    catch (e) { this.logger.warn?.('[teams.azure] onReady threw', e?.message); }
  }

  pushFrame(pcm16Buffer) {
    if (this._closing || !this._pushStream) return;
    if (!Buffer.isBuffer(pcm16Buffer) || pcm16Buffer.length === 0) return;
    if (!this._started) {
      // Bound the queue (~5 s of 48 kHz mono 16-bit @ 100 ms chunks = 50).
      // start_continuous_recognition typically succeeds within ~1 s, so
      // exceeding 100 entries means the SDK is wedged — drop and warn so
      // we don't grow unbounded.
      if (this._internalQueue.length < 100) {
        this._internalQueue.push(pcm16Buffer);
      }
      return;
    }
    this._writeToStream(pcm16Buffer);
    this._lastRealAudioMs = Date.now();
    const now = this._lastRealAudioMs;
    if (now - this._lastStatsLogMs >= 5000) {
      this._lastStatsLogMs = now;
      const audioMs = this.sampleRate ? Math.round(this._bytesSent / (this.sampleRate * 2) * 1000) : 0;
      this.logger.info?.('[teams.azure] push stats', {
        sessionId: this.sessionId,
        chunks: this._chunksSent,
        bytes: this._bytesSent,
        audio_ms: audioMs,
        events: this._eventCounts,
      });
    }
  }

  _writeToStream(pcm16Buffer) {
    this._audioDump?.write(pcm16Buffer);
    const ab = pcm16Buffer.buffer.slice(
      pcm16Buffer.byteOffset,
      pcm16Buffer.byteOffset + pcm16Buffer.byteLength,
    );
    this._pushStream.write(ab);
    this._chunksSent += 1;
    this._bytesSent += pcm16Buffer.byteLength;
  }

  // Why this exists:
  //   Floor-owner attribution upstream stops calling `pushFrame` the moment
  //   the current speaker stops talking. From Azure's view, the input stream
  //   just paused — there is no silence in the buffer to trip the
  //   `Speech_SegmentationSilenceTimeoutMs` boundary. Result: partials keep
  //   accumulating into a multi-turn fused hypothesis and `RecognizedSpeech`
  //   (final) never fires, so nothing lands in the DB.
  //
  //   We pump explicit zero-byte PCM silence into the SDK's
  //   PushAudioInputStream after a 500ms gap, in
  //   200ms chunks every 200ms, until either real audio resumes or the gap
  //   exceeds 1500ms (after which we stop — past that point the speaker has
  //   genuinely yielded and the next utterance should start fresh).
  _startSilencePump() {
    if (this._silenceTimer) return;
    this._silenceTimer = setInterval(() => this._maybeSendSilence(), TRAILING_SILENCE_TICK_MS);
    if (typeof this._silenceTimer.unref === 'function') this._silenceTimer.unref();
  }

  _stopSilencePump() {
    if (this._silenceTimer) {
      clearInterval(this._silenceTimer);
      this._silenceTimer = null;
    }
  }

  _maybeSendSilence() {
    if (this._closing || !this._pushStream || !this._started) return;
    if (this._lastRealAudioMs === 0) return;  // never received a real frame yet
    const now = Date.now();
    const gap = now - this._lastRealAudioMs;
    if (gap < TRAILING_SILENCE_AFTER_MS) return;
    if (gap > TRAILING_SILENCE_MAX_MS) return;
    if (now - this._lastSilenceSentMs < TRAILING_SILENCE_CHUNK_MS) return;
    const silenceBytes = Math.round(this.sampleRate * 2 * TRAILING_SILENCE_CHUNK_MS / 1000);
    if (silenceBytes <= 0) return;
    const buf = Buffer.alloc(silenceBytes);
    try {
      const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
      this._pushStream.write(ab);
      this._silenceChunksSent += 1;
      this._silenceBytesSent += silenceBytes;
      this._lastSilenceSentMs = now;
    } catch (e) {
      this.logger.warn?.('[teams.azure] silence write failed', { err: e?.message });
    }
  }

  heartbeat() {
    // No-op. Azure's SDK manages the websocket keep-alive on its own and the
    // PushAudioInputStream tolerates idle gaps without tearing down the
    // recognizer. Method is kept for surface compatibility with the pool.
  }

  async close() {
    this._closing = true;
    this._stopSilencePump();
    try {
      if (this._pushStream) {
        try { this._pushStream.close(); } catch (_) { /* swallow */ }
      }
      if (this._recognizer && this._started) {
        await new Promise((resolve) => {
          this._recognizer.stopContinuousRecognitionAsync(
            () => resolve(),
            () => resolve(),
          );
        });
      }
    } finally {
      this._audioDump?.close();
      this._audioDump = null;
      try { this._recognizer?.close(); } catch (_) { /* swallow */ }
      this._recognizer = null;
      this._pushStream = null;
    }
  }

  _buildSpeechConfig() {
    return createAzureSpeechConfig({
      sdk,
      endpoint: this.endpoint,
      key: this.subscriptionKey,
      region: this.region,
      containerEndpoint: this.containerEndpoint,
      preferWebSocket: true,
      preferRegionKeyInAuto: true,
    });
  }

  _handleResult(result, isFinal) {
    if (!result) return;
    if (isFinal) {
      if (result.reason !== sdk.ResultReason.RecognizedSpeech) return;
    } else if (result.reason !== sdk.ResultReason.RecognizingSpeech) {
      return;
    }
    const text = (result.text || '').trim();
    if (!text) return;

    const startMs = this._ticksToWallMs(result.offset);
    const endMs = this._ticksToWallMs(addBigSafe(result.offset, result.duration));
    const words = isFinal ? this._wordsFromResult(result, this.meetingStartMs) : [];

    const segment = Object.freeze({
      // Per-participant attribution upstream: no diarization here.
      speaker_idx: null,
      speaker_label: null,
      start_ms: startMs,
      end_ms: endMs,
      text,
      is_final: isFinal,
      provider: 'azure_speech',
      confidence: extractTopConfidence(result),
      words,
      raw: { result_id: result.resultId || null, session_id: this.sessionId },
    });
    try { this.onSegment(segment); }
    catch (e) { this.logger.warn?.('[teams.azure] onSegment threw', e?.message); }
  }

  _ticksToWallMs(ticks) {
    const ms = ticksToMs(ticks);
    return Math.round(this.meetingStartMs + Math.max(0, ms));
  }

  _wordsFromResult(result, baseWallMs) {
    let detailJson;
    try {
      detailJson = result.properties?.getProperty(
        sdk.PropertyId.SpeechServiceResponse_JsonResult,
      );
    } catch (_) { return []; }
    if (!detailJson) return [];
    let parsed;
    try { parsed = JSON.parse(detailJson); } catch (_) { return []; }
    const nbest = parsed?.NBest;
    if (!Array.isArray(nbest) || nbest.length === 0) return [];
    const wordsRaw = nbest[0]?.Words;
    if (!Array.isArray(wordsRaw) || wordsRaw.length === 0) return [];
    return wordsRaw.map((w) => ({
      word: String(w.Word || '').trim(),
      start_ms: Math.round(baseWallMs + ticksToMs(w.Offset)),
      end_ms: Math.round(baseWallMs + ticksToMs(addBigSafe(w.Offset, w.Duration))),
      speaker_idx: null,
      confidence: typeof w.Confidence === 'number' ? w.Confidence : null,
    }));
  }
}

function ticksToMs(ticks) {
  if (ticks == null) return 0;
  // result.offset / result.duration come back as numbers from the SDK in
  // recent versions; tolerate BigInt just in case.
  if (typeof ticks === 'bigint') return Number(ticks / BigInt(TICKS_PER_MS));
  const n = Number(ticks);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n / TICKS_PER_MS;
}

function addBigSafe(a, b) {
  if (typeof a === 'bigint' || typeof b === 'bigint') {
    return BigInt(a || 0) + BigInt(b || 0);
  }
  return (Number(a) || 0) + (Number(b) || 0);
}

function extractTopConfidence(result) {
  try {
    const json = result.properties?.getProperty(sdk.PropertyId.SpeechServiceResponse_JsonResult);
    if (!json) return null;
    const parsed = JSON.parse(json);
    const c = parsed?.NBest?.[0]?.Confidence;
    return typeof c === 'number' ? c : null;
  } catch (_) {
    return null;
  }
}

module.exports = { AzureSpeechAdapter };
