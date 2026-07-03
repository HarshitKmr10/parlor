'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { Buffer } = require('node:buffer');
const { TranscriptionAdapter, RESULT_KIND } = require('./transcription');
const { isSpeech } = require('./vad');
const { shouldDrop } = require('./hallucinationFilter');
const { attributeFromTrack, speakerSlug } = require('./speakerMapper');
const teamsCaptionScript = require('./teamsCaptionScript');
const { ClosedCaptionManager } = require('./closedCaptionManager');
const { TRANSCRIPT_SOURCE, normalizeTranscriptSource } = require('./transcriptSource');

// Number of corroborations required before a CSRC source ID is locked
// to a display name. Each corroboration = one chunk window where this
// source was the only CSRC firing AND rosterWatcher resolved a single
// active-speaker name. 3 protects against a single bad rosterWatcher
// reading mis-mapping a source permanently. At 200ms chunks this is
// ~600ms of clean signal — acceptable cold-start.
const CSRC_LOCK_THRESHOLD = Number(process.env.MSTEAMS_CSRC_LOCK_THRESHOLD) || 3;

// Brokers between the in-page recorder (PCM/WAV ArrayBuffers per track) and
// the multi-provider transcription stack. Three responsibilities:
//   1. Per-track concurrency: serialize chunks for one track so segments
//      stay ordered, parallelize across tracks for throughput.
//   2. VAD gate before paying for a transcription round-trip.
//   3. Hallucination filter after the provider returns text.
//
// onSegment receives speaker-attributed segments ready to publish. The caller
// owns persistence (file dump, websocket, real-time processor handoff).
//
// Why we write WAV to disk before transcribing: the existing
// MultiProviderTranscriber takes a file path. Some providers (AWS, Bedrock)
// upload from disk; others stream the file. Materialising the chunk also
// gives us a free debug artifact when MSTEAMS_DUMP_AUDIO=true.

class CaptureBridge {
  constructor({
    logger, transcription, scratchDir, dumpDir, onSegment, onTrack,
    roster, rosterWatcher, meetingStartMs,
    attributionMode = (process.env.MSTEAMS_ATTRIBUTION_MODE || 'dom').toLowerCase(),
    transcriptSource = normalizeTranscriptSource(),
    dbIntegration = null,
    meetingId = null,
    botName = null,
  } = {}) {
    if (!scratchDir) throw new Error('CaptureBridge: scratchDir required');
    this.logger = logger || console;
    const mode = String(attributionMode || '').toLowerCase();
    this.attributionMode = mode === 'webrtc_csrc' ? 'webrtc_csrc' : 'dom';
    this.transcriptSource = normalizeTranscriptSource(transcriptSource);
    this.transcription = transcription
      || (this.transcriptSource !== TRANSCRIPT_SOURCE.TEAMS_CAPTIONS && this.attributionMode !== 'webrtc_csrc'
        ? new TranscriptionAdapter({ logger })
        : null);
    this.scratchDir = scratchDir;
    this.dumpDir = dumpDir;
    this.onSegment = typeof onSegment === 'function' ? onSegment : () => {};
    this.onTrackCallback = typeof onTrack === 'function' ? onTrack : null;
    this.roster = roster || { list: [], byName: {}, byPeerId: {} };
    this.rosterWatcher = rosterWatcher || null;
    this.meetingStartMs = Number(meetingStartMs) || Date.now();

    this.dbIntegration = dbIntegration;
    this.meetingId = meetingId;
    this.botName = botName;

    // ─── CSRC-based attribution (correlation map) ────────────────────
    // CSRC source IDs (RTP contributing-source identifiers) are stable
    // per participant per session. The in-page recorder polls
    // `RTCRtpReceiver.getContributingSources()` at chunk boundaries and
    // ships the source list as `csrc_sources` on each PCM chunk
    // payload. We learn `source_id → display_name` over time:
    //
    //   1. When ONE CSRC source is firing in a chunk window AND the
    //      rosterWatcher's tile observer says "X is the active speaker",
    //      that's a corroboration — increment the candidate count for
    //      (source → X).
    //   2. After CSRC_LOCK_THRESHOLD corroborations, promote the mapping
    //      from `_csrcCandidates` to the locked `_csrcSourceMap`.
    //   3. Locked mappings are used as the highest-confidence
    //      attribution path (`csrc_match`) — beats DOM, beats RMS, beats
    //      everything except a direct caption_author match.
    //
    // 3 corroborations protects against a single bad rosterWatcher
    // reading mis-mapping a source permanently. At 200ms chunks this is
    // ~600ms of clean signal per participant — acceptable cold-start.
    this._csrcSourceMap = new Map();        // source → name (locked)
    this._csrcCandidates = new Map();       // source → { name, count }
    // Cumulative non-bot names ever observed in the rosterWatcher snapshot.
    // The rosterWatcher flickers between 0 and 1 participants every ~30ms
    // because Teams' tile DOM thrashes — relying on the live snapshot
    // alone caused per-track attribution to miss the participant exactly
    // when activeSpeakerName was also null, falling to "Speaker N"
    // (peer_label) instead of the obvious "exactly one human in the
    // panel" → roster_solo. The binder solves this for diarized
    // segments via its own _seenNames Set; the per-track path needs
    // the same survives-flicker view.
    this._seenHumans = new Set();
    // Last person we confidently attributed a segment to. Used as the
    // last-resort fallback per explicit user request: "if you don't
    // know who is speaking, just map it to the previous user." Beats
    // emitting "Speaker N" every time the rosterWatcher snapshot
    // happens to land during a 0-participant flicker.
    this._lastBoundSpeaker = null;
    this._lastAudioAttributedSpeaker = null;
    this._lastAudioAttributedTs = 0;
    this._csrcAttribution = null;
    this.queues = new Map(); // trackId -> Promise tail
    this.captionSeq = 0;
    this.closedCaptionManager = new ClosedCaptionManager({
      logger: this.logger,
      saveCaptionCallback: (message) => this._publishCaptionMessage(message),
    });
    // Per-track exponentially-weighted moving average of recent chunk RMS.
    // Used to identify the "loud" track on multi-track meetings: Teams' mixed
    // audio leaks into every WebRTC track at low level, but only the actively
    // speaking participant's track is consistently above the rest.
    this.trackRMS = new Map(); // trackId -> { ewma, lastTs, peerId }
    // Drop chunks that are below this fraction of the loudest track's
    // current RMS — suppresses duplicate transcription of the same speech
    // bleeding through other tracks. 0.30 means: a track must be at least
    // 30% as loud as the leader to be transcribed.
    this.rmsRelativeFloor = parseFloat(process.env.MSTEAMS_RMS_FLOOR || '0.30');
    this.stats = {
      received: 0,
      vadDropped: 0,
      rmsDropped: 0,
      hallucinationDropped: 0,
      published: 0,
      captionsPublished: 0,
      errors: 0,
      bytesWritten: 0,
    };
  }

  // Update the EWMA for this track and return the relative loudness ratio
  // (this track's EWMA / max of any other track's EWMA). 1.0 means this
  // track is the loudest; <1.0 means another track is louder.
  _updateTrackRMS(trackId, peerId, rms, ts) {
    const ALPHA = 0.4; // weight for new sample; higher = more reactive.
    const prev = this.trackRMS.get(trackId);
    const ewma = prev ? (prev.ewma * (1 - ALPHA) + rms * ALPHA) : rms;
    this.trackRMS.set(trackId, { ewma, lastTs: ts, peerId });

    // Compute max EWMA across OTHER tracks. Skip stale entries (>20s old)
    // so a participant who left doesn't permanently raise the bar.
    let maxOther = 0;
    const cutoff = ts - 20_000;
    for (const [tid, st] of this.trackRMS.entries()) {
      if (tid === trackId) continue;
      if (st.lastTs < cutoff) continue;
      if (st.ewma > maxOther) maxOther = st.ewma;
    }
    if (maxOther <= 0) return 1.0;
    return ewma / maxOther;
  }

  async ready() {
    await fs.mkdir(this.scratchDir, { recursive: true });
    if (this.dumpDir) await fs.mkdir(this.dumpDir, { recursive: true });
  }

  async expose(page) {
    await this.ready();
    const context = typeof page.context === 'function' ? page.context() : null;
    await page.exposeFunction('__teamsBridgeOnTrack', (info) => this._onTrack(info));
    await page.exposeBinding(
      '__teamsBridgeOnPcmChunk',
      async (_source, payload) => {
        try { await this._onChunk(payload); }
        catch (e) { this.stats.errors++; this.logger.warn?.('[teams.capture] chunk failed', e?.message); }
      }
    );
    // Caption pipeline (Vexa-style). The in-page caption observer fires
    // (speaker, text, ts) for each new caption update. Treat each as a
    // ready-to-publish transcript segment — Teams' own ASR is the source.
    await page.exposeFunction('__teamsBridgeOnCaption', async (payload) => {
      try { await this._onCaption(payload); }
      catch (e) { this.stats.errors++; this.logger.warn?.('[teams.capture] caption failed', e?.message); }
    });

    if (this.transcriptSource === TRANSCRIPT_SOURCE.TEAMS_CAPTIONS) {
      if (context) await context.addInitScript(teamsCaptionScript.SCRIPT);
      await page.exposeFunction('__teamsBridgeOnCaptionUpdate', async (payload) => {
        try { await this._onCaptionUpdate(payload); }
        catch (e) { this.stats.errors++; this.logger.warn?.('[teams.capture] caption update failed', e?.message); }
      });
      this.logger.info?.('[teams.capture] teams caption channel installed');
    }

    if (this.attributionMode === 'webrtc_csrc' && this.transcriptSource !== TRANSCRIPT_SOURCE.TEAMS_CAPTIONS) {
      this._ensureCsrcAttribution();
      if (context) await this._csrcAttribution.install(context);
      await this._csrcAttribution.bindPage(page);
    }
  }

  _onTrack(info) {
    this.logger.info?.('[teams.capture] new track', info);
    if (this.onTrackCallback) {
      try { this.onTrackCallback(info); }
      catch (e) { this.logger.warn?.('[teams.capture] onTrack callback failed', e?.message); }
    }
  }

  async _onChunk({ trackId, peerId, ts_start_ms, ts_end_ms, sample_rate, wav, wav_b64, rms, csrc_sources }) {
    this.stats.received += 1;

    if (this.transcriptSource === TRANSCRIPT_SOURCE.TEAMS_CAPTIONS) {
      this.stats.skippedCaptionMode = (this.stats.skippedCaptionMode || 0) + 1;
      return;
    }

    if (this.attributionMode === 'webrtc_csrc') {
      this.stats.skippedWebrtcCsrc = (this.stats.skippedWebrtcCsrc || 0) + 1;
      return;
    }

    // CSRC correlation learning. The recorder polls
    // `RTCRtpReceiver.getContributingSources()` at chunk boundaries and
    // ships the source list as `csrc_sources` on the chunk payload.
    // When ONE CSRC source is firing in this chunk window AND the
    // rosterWatcher's active-speaker resolves to a single name, we
    // increment that source's mapping candidate; after
    // CSRC_LOCK_THRESHOLD corroborations the mapping is locked into
    // `_csrcSourceMap` and used as the highest-confidence attribution
    // signal in `attributeFromTrack`.
    if (Array.isArray(csrc_sources) && csrc_sources.length > 0 && this.rosterWatcher
      && typeof this.rosterWatcher.getActiveSpeakerInWindow === 'function') {
      let active = null;
      try {
        active = this.rosterWatcher.getActiveSpeakerInWindow(
          Number(ts_start_ms),
          Number(ts_end_ms) || (Number(ts_start_ms) + 5_000),
        );
      } catch (_) { /* ignore */ }
      this._learnCsrcMapping(csrc_sources, active);
    }

    // Per-track loudness gate. Teams' mixed audio leaks into every WebRTC
    // track at low level — without this, every track produces a chunk every
    // window and we transcribe the same speech multiple times, attributing
    // it to whoever happens to win the active-speaker tie. By dropping any
    // track that's significantly quieter than the leader, we keep only the
    // chunk from the track where the speech is actually originating.
    const numericRMS = Number.isFinite(rms) ? Number(rms) : 0;
    const ratio = this._updateTrackRMS(trackId, peerId, numericRMS, Date.now());
    if (this.trackRMS.size > 1 && ratio < this.rmsRelativeFloor) {
      this.stats.rmsDropped += 1;
      this.logger.info?.('[teams.capture] dropped (low RMS)', {
        trackId, peerId, rms: numericRMS.toFixed(4), ratio: ratio.toFixed(2),
      });
      return;
    }
    if (numericRMS > 0) {
      this.logger.info?.('[teams.capture] chunk', {
        trackId, peerId, rms: numericRMS.toFixed(4), ratio: ratio.toFixed(2),
      });
    }

    // The page-realm recorder sends WAV as base64 (string) because
    // Playwright's exposeBinding strips ArrayBuffer / TypedArray identity.
    // Older payloads may still arrive with `wav` (Object/Array form) — try
    // base64 first, then fall back to the legacy shape.
    const wavBuffer = wav_b64
      ? Buffer.from(wav_b64, 'base64')
      : Buffer.from(wav);

    // VAD gate first — skip if low energy or out-of-band ZCR.
    const v = isSpeech(wavBuffer.buffer);
    if (!v.speech) {
      this.stats.vadDropped += 1;
      return;
    }

    const wavPath = await this._materialise({ trackId, ts_start_ms, wavBuffer });

    // Serialise per-track to keep order. Parallelise across tracks.
    const tail = this.queues.get(trackId) || Promise.resolve();
    const next = tail.then(() => this._process({
      trackId, peerId, ts_start_ms, ts_end_ms, sample_rate, wavPath, csrc_sources,
    })).catch((err) => {
      this.stats.errors++;
      this.logger.warn?.('[teams.capture] process failed', err?.message);
    });
    this.queues.set(trackId, next);
  }

  async _materialise({ trackId, ts_start_ms, wavBuffer }) {
    const safeTrack = String(trackId).replace(/[^A-Za-z0-9_-]/g, '_');
    const fname = `t${safeTrack}_${ts_start_ms}.wav`;
    const target = this.dumpDir
      ? path.join(this.dumpDir, fname)
      : path.join(this.scratchDir, fname);
    await fs.writeFile(target, wavBuffer);
    this.stats.bytesWritten += wavBuffer.byteLength;
    return target;
  }

  async _cleanup(wavPath) {
    if (this.dumpDir) return; // keep for debug/replay
    await fs.unlink(wavPath).catch(() => {});
  }

  async _process({ trackId, peerId, ts_start_ms, ts_end_ms, sample_rate, wavPath, csrc_sources }) {
    const startOffsetSec = Math.max(0, (Number(ts_start_ms) - this.meetingStartMs) / 1000);

    let result;
    try {
      result = await this.transcription.transcribe(wavPath, { startOffsetSec });
    } catch (err) {
      await this._cleanup(wavPath);
      this.logger.warn?.('[teams.capture] transcribe error', err?.message);
      return;
    }
    await this._cleanup(wavPath);

    if (!result || result.kind === RESULT_KIND.EMPTY || !result.text) return;

    const drop = shouldDrop({ text: result.text });
    if (drop.drop) {
      this.stats.hallucinationDropped += 1;
      return;
    }

    const rosterSnapshot = typeof this.roster === 'function' ? this.roster() : this.roster;
    // Update the cumulative non-bot names set so per-track attribution
    // survives roster flicker. Without this, attribution falls to
    // "Speaker N" exactly when the rosterWatcher returned an empty
    // snapshot during a brief tile-DOM thrash.
    if (rosterSnapshot && Array.isArray(rosterSnapshot.list)) {
      const bot = (this.botName || '').trim().toLowerCase();
      for (const entry of rosterSnapshot.list) {
        // rosterWatcher.snapshot().list returns OBJECTS like
        // { name, speaking } — NOT plain strings. The prior
        // `typeof entry !== 'string' continue` silently dropped every
        // entry → roster_solo never fired → "Speaker N" appeared in
        // transcripts despite all the cumulative-seen patches we shipped.
        // Verified live during testing (bot "ABC TESTING", lone human
        // "Jane Doe"): segments still came back as Speaker 2 / peer_label.
        const name = typeof entry === 'string' ? entry : entry?.name;
        if (typeof name !== 'string' || !name.trim()) continue;
        const a = name.trim().toLowerCase();
        if (bot && (a === bot || a.includes(bot) || bot.includes(a))) continue;
        this._seenHumans.add(name);
      }
    }
    // Resolve the speaker name from rosterWatcher's history of who was
    // marked "speaking" during the chunk's wall-clock window. This is the
    // primary attribution path on guest meetings where Teams captions
    // can't be enabled programmatically.
    let activeSpeakerName = null;
    if (this.rosterWatcher && typeof this.rosterWatcher.getActiveSpeakerInWindow === 'function') {
      try {
        activeSpeakerName = this.rosterWatcher.getActiveSpeakerInWindow(
          Number(ts_start_ms),
          Number(ts_end_ms) || (Number(ts_start_ms) + 5_000)
        );
      } catch (_) { /* ignore */ }
    }
    // Pass the cumulative seen-humans list (NOT just the live snapshot)
    // so roster_solo fires when exactly one human has EVER been observed,
    // even if the live snapshot is momentarily empty.
    const cumulativeList = Array.from(this._seenHumans);
    // Resolve CSRC source IDs to display names through the locked
    // mapping. The recorder ships csrc_sources captured at chunk
    // boundaries; if we've already learned (source_id → name) for any
    // of them, that's the highest-confidence attribution available
    // (CSRC is voice-independent, overlap-aware, and survives roster
    // flicker). attributeFromTrack picks the dominant matched source
    // — see speakerMapper.js for the priority order.
    const csrcMatched = (Array.isArray(csrc_sources) ? csrc_sources : [])
      .map((c) => ({
        source: Number(c.source),
        name: this._csrcSourceMap.get(Number(c.source)) || null,
        audioLevel: c.audioLevel,
        timestamp: c.timestamp,
      }))
      .filter((c) => Number.isFinite(c.source));
    const attribution = attributeFromTrack({
      peerId,
      trackId,
      peerLabel: peerId != null ? `Speaker ${peerId}` : null,
      roster: { list: cumulativeList },
      activeSpeakerName,
      botName: this.botName,
      lastBoundSpeaker: this._lastBoundSpeaker,
      csrcSources: csrcMatched,
    });
    // Remember this attribution if it resolved to a real (non-bot) name,
    // so the next chunk can fall back to it instead of "Speaker N" when
    // signals are momentarily silent.
    if (attribution.confidence !== 'fallback'
      && attribution.speaker
      && attribution.speaker !== 'Unknown speaker'
      && !/^Speaker\s*\d+$/i.test(attribution.speaker)) {
      this._lastBoundSpeaker = attribution.speaker;
    }

    // Bedrock/HealthScribe return segment-only granularity; OpenAI/Azure/AWS
    // return word-level. Normalise both into a single segment payload anchored
    // to wall-clock ms via meetingStartMs.
    const anchorSec = this.meetingStartMs / 1000;
    const words = (result.words || []).map((w) => ({
      word: w.word,
      start: anchorSec + w.start,
      end: anchorSec + w.end,
      probability: w.probability,
    }));

    const segment = Object.freeze({
      id: `${trackId}_${ts_start_ms}`,
      track_id: trackId,
      peer_id: peerId,
      speaker: attribution.speaker,
      speaker_id: attribution.speaker_id,
      attribution_confidence: attribution.confidence,
      start_ms: Number(ts_start_ms) || 0,
      end_ms: Number(ts_end_ms) || (Number(ts_start_ms) + 5_000),
      sample_rate,
      language: result.language || null,
      provider: this.transcription.providerName,
      kind: result.kind,
      text: result.text,
      words,
    });

    this.stats.published += 1;
    this._recordAudioAttribution(segment.speaker);
    try { await this.onSegment(segment); }
    catch (err) { this.logger.warn?.('[teams.capture] onSegment failed', err?.message); }
  }

  // Record a freshly-attributed non-bot speaker for the aloneness
  // watcher's audio-path fallback. Called from both the per-track
  // path (`_process`) and the CSRC streaming path (`_onCsrcSegment`)
  // and the captions path (`_onCaption`) — anywhere the bridge
  // publishes a real speaker.
  _recordAudioAttribution(speakerName) {
    if (!speakerName || typeof speakerName !== 'string') return;
    if (this._isBot(speakerName)) return;
    if (speakerName === 'Unknown speaker') return;
    if (/^Speaker\s*\d+$/i.test(speakerName)) return;
    this._lastAudioAttributedSpeaker = speakerName;
    this._lastAudioAttributedTs = Date.now();
  }

  // Aloneness watcher consumes this. Returns the latest non-bot
  // speaker the bridge has attributed audio to, with the timestamp
  // it was recorded. Aloneness ignores anything older than its
  // audioFreshMs window.
  getRecentAttributedSpeaker() {
    if (!this._lastAudioAttributedSpeaker) return null;
    return {
      name: this._lastAudioAttributedSpeaker,
      tsMs: this._lastAudioAttributedTs,
    };
  }

  // ─── CSRC correlation ─────────────────────────────────────────────
  // Called from `_onChunk` with the CSRC source list captured at chunk
  // emission time. Updates `_csrcCandidates` based on the rosterWatcher
  // signal AND promotes locked mappings into `_csrcSourceMap` after
  // CSRC_LOCK_THRESHOLD corroborations.
  _learnCsrcMapping(csrcSources, activeSpeakerName) {
    if (!Array.isArray(csrcSources) || csrcSources.length !== 1) return;
    if (!activeSpeakerName || typeof activeSpeakerName !== 'string') return;
    if (this._isBot(activeSpeakerName)) return;
    const source = Number(csrcSources[0].source);
    if (!Number.isFinite(source)) return;
    if (this._csrcSourceMap.has(source)) return; // already locked
    const cand = this._csrcCandidates.get(source);
    if (!cand || cand.name !== activeSpeakerName) {
      this._csrcCandidates.set(source, { name: activeSpeakerName, count: 1 });
      return;
    }
    cand.count += 1;
    if (cand.count >= CSRC_LOCK_THRESHOLD) {
      this._csrcSourceMap.set(source, cand.name);
      this._csrcCandidates.delete(source);
      this.logger.info?.('[teams.capture] csrc locked', { source, name: cand.name });
    }
  }

  _isBot(name) {
    if (!this.botName || !name) return false;
    const a = String(name).trim().toLowerCase();
    const b = String(this.botName).trim().toLowerCase();
    return a === b || a.includes(b) || b.includes(a);
  }

  _ensureCsrcAttribution() {
    if (this._csrcAttribution) return this._csrcAttribution;
    if (this.attributionMode !== 'webrtc_csrc') return null;

    const { composeWebrtcCsrcAttribution } = require('../../../processors/csrcAttribution');
    this._csrcAttribution = composeWebrtcCsrcAttribution({
      logger: this.logger,
      meetingStartMs: this.meetingStartMs,
      region: process.env.AWS_REGION || 'us-east-1',
      languageCode: process.env.TRANSCRIPTION_LANGUAGE || 'en-US',
      sampleRate: 16_000,
      maxSessions: Number(process.env.MSTEAMS_CSRC_MAX_SESSIONS) || 4,
      meetingId: this.meetingId,
      onSegment: (seg) => this._onCsrcSegment(seg),
      onError: (err, pid) => this.logger.warn?.('[teams.capture] csrc pool error', { pid, err: err?.message }),
    });
    this.logger.info?.('[teams.capture] csrc attribution composition started');
    return this._csrcAttribution;
  }

  _onCsrcSegment(rawSeg) {
    if (!rawSeg) return;
    const pid = rawSeg.participant_id || 'unknown';
    const name = rawSeg.participant_name || (pid === 'unknown' ? 'Unknown speaker' : pid);
    const resultId = rawSeg.raw?.result_id || `r${Date.now()}`;
    const segment = Object.freeze({
      id: `${rawSeg.provider || 'aws'}_${pid}_${resultId}_${rawSeg.start_ms || 0}`,
      track_id: null,
      peer_id: null,
      speaker: name,
      speaker_id: `csrc_${pid}`,
      attribution_confidence: pid === 'unknown' ? 'unknown' : 'csrc_locked',
      start_ms: Number(rawSeg.start_ms) || Date.now(),
      end_ms: Number(rawSeg.end_ms) || (Number(rawSeg.start_ms) + 1_000),
      sample_rate: 16_000,
      language: null,
      provider: rawSeg.provider || 'aws_transcribe',
      kind: rawSeg.is_final ? 'final' : 'partial',
      text: rawSeg.text || '',
      words: (rawSeg.words || []).map((w) => ({
        word: w.word,
        start: (Number(w.start_ms) || rawSeg.start_ms) / 1000,
        end: (Number(w.end_ms) || rawSeg.end_ms) / 1000,
        probability: typeof w.confidence === 'number' ? w.confidence : null,
      })),
      diarization: {
        participant_id: pid,
        participant_name: name,
        result_id: resultId,
      },
    });
    if (rawSeg.is_final) this.stats.published += 1;
    if (rawSeg.is_final) this._recordAudioAttribution(name);
    Promise.resolve(this.onSegment(segment))
      .catch((err) => this.logger.warn?.('[teams.capture] onSegment failed', err?.message));
  }

  async stop() {
    if (this.closedCaptionManager) {
      try { await this.closedCaptionManager.flushCaptions(); }
      catch (err) { this.logger.warn?.('[teams.capture] caption flush failed', err?.message); }
    }

    if (this._csrcAttribution) {
      try {
        const stats = this._csrcAttribution.stats?.();
        if (stats) this.logger.info?.('[teams.capture] csrc final stats', stats);
        await this._csrcAttribution.stop();
      } catch (_) { /* ignore */ }
      this._csrcAttribution = null;
    }
  }

  // ─── DELETED: diarizer layer ─────────────────────────────────────
  // The mixed-stream diarizer (AssemblyAI / AWS Transcribe Streaming /
  // Deepgram via ResilientStreamer + DiarizationBinder) was deleted in
  // PR #3500 because it produced ZERO segments that reached the DB
  // across 20+ meetings while burning AWS streaming session minutes.
  // CSRC-based correlation (above) covers the same problem space
  // without the brittle WS lifecycle. See git history for details.
  // Caption-driven segment publish. Vexa-style: Teams' own ASR text IS the
  // transcript. Speaker attribution is direct (no roster index lookup
  // needed) because the caption tells us the name.
  async _onCaption({ speaker, text, ts_ms } = {}) {
    if (!speaker || !text) return;
    const ts = Number(ts_ms) || Date.now();
    this.captionSeq += 1;
    // Use the same name-based slug as audio attribution so the dashboard
    // collapses caption + STT segments for the same person onto one row.
    const speakerId = speakerSlug(speaker);
    const segment = Object.freeze({
      id: `caption_${this.captionSeq}_${ts}`,
      track_id: null,
      peer_id: null,
      speaker,
      speaker_id: speakerId,
      attribution_confidence: 'high',
      start_ms: ts,
      end_ms: ts + Math.max(1_000, Math.min(8_000, text.length * 60)),
      sample_rate: null,
      language: null,
      provider: 'teams_captions',
      kind: 'caption',
      text,
      words: [],
    });
    this.stats.captionsPublished += 1;
    this.logger.info?.('[teams.capture] caption', { speaker, len: text.length });
    this._recordAudioAttribution(speaker);
    try { await this.onSegment(segment); }
    catch (err) { this.logger.warn?.('[teams.capture] caption publish failed', err?.message); }
  }

  async _onCaptionUpdate(payload = {}) {
    if (this.transcriptSource !== TRANSCRIPT_SOURCE.TEAMS_CAPTIONS) return;
    // Feed the aloneness watcher's audio-path getter even in captions mode.
    // Without this, getRecentAttributedSpeaker() stays null for the whole
    // call (captureBridge's STT/CSRC paths are inactive in captions mode),
    // so the watcher's only signal is the DOM roster — which on guest /
    // anonymous Teams meetings has been observed to go silent mid-call
    // and trigger spurious left_alone_timeout drops at ~20-25 min.
    // _recordAudioAttribution already filters bot/Unknown names.
    const speaker = payload?.speakerName || payload?.participantName || payload?.displayName;
    if (speaker) this._recordAudioAttribution(speaker);
    this.closedCaptionManager.upsertCaption(payload);
    await this.closedCaptionManager.processCaptions();
  }

  async _publishCaptionMessage(message) {
    if (!message || !message.text) return;
    const ts = Number(message.timestamp_ms) || Date.now();
    const durationMs = Math.max(0, Number(message.duration_ms) || 0);
    const speaker = message.speaker_name || 'Unknown';
    const segment = Object.freeze({
      id: `caption_${message.source_uuid_suffix}`,
      track_id: null,
      peer_id: null,
      speaker,
      speaker_id: speakerSlug(speaker),
      attribution_confidence: 'platform_caption',
      start_ms: ts,
      end_ms: ts + Math.max(1, durationMs),
      sample_rate: null,
      language: null,
      provider: 'teams_captions',
      kind: 'caption',
      text: message.text,
      words: [],
      source: 'closed_caption_from_platform',
      device_id: message.device_id,
      caption_id: message.caption_id,
      is_final: message.is_final,
      audio_timestamp: message.audio_timestamp,
    });
    this.stats.captionsPublished += 1;
    this.logger.info?.('[teams.capture] caption final', { speaker, len: message.text.length });
    try { await this.onSegment(segment); }
    catch (err) { this.logger.warn?.('[teams.capture] caption publish failed', err?.message); }
  }
}

module.exports = { CaptureBridge };
