'use strict';

const { Buffer } = require('node:buffer');
const { PerParticipantStreamPool } = require('../../../processors/csrcAttribution/PerParticipantStreamPool');
const { pickAsrAdapterFactory } = require('../../../processors/csrcAttribution/asrProvider');
const { speakerSlug } = require('../msteams/speakerMapper');
const { shouldDrop } = require('../msteams/hallucinationFilter');

// Google Meet capture bridge — the Node-side counterpart to
// perPeerCaptureScript.js. The page-realm script ships already-attributed
// PCM frames keyed by `pid` (the stable per-participant identifier
// derived from CSRC source ID + DOM correlation). Each pid drives a
// dedicated AWS Transcribe Streaming session via PerParticipantStreamPool
// — no mixed-track diarization, no overlap tiebreak, no CSRC-routing
// state machine. Per-peer architecture removes the entire complexity
// surface that Teams' bridge had to deal with.
//
// Frame payload (matches perPeerCaptureScript.js):
//   { pid, name, participant_id, csrc_source, pcm_b64, sample_rate,
//     ts_ms, rms, track_id }
//
// onSegment receives normalised segments ready to publish. Caller owns
// persistence (dbIntegration.appendTranscriptSegment is the canonical
// path for the dashboard).

class CaptureBridge {
  constructor({
    logger,
    rosterWatcher,
    onSegment,
    botName = null,
    meetingStartMs,
    region,
    languageCode,
    sampleRate = 16_000,
    maxSessions,
    // Lets tests inject a fake adapter directly. Production path picks
    // AWS or Azure via the shared asrProvider helper below.
    adapterFactory,
    asrProvider,
  } = {}) {
    this.logger = logger || console;
    this.rosterWatcher = rosterWatcher || null;
    this.onSegment = typeof onSegment === 'function' ? onSegment : () => {};
    this.botName = botName;
    this.meetingStartMs = Number(meetingStartMs) || Date.now();
    this._exposed = false;
    this._pidNames = new Map();
    this._lastAudioAttributedSpeaker = null;
    this._lastAudioAttributedTs = 0;

    // Resolve the adapter factory. Shared with Teams' webrtc_csrc path
    // via asrProvider.js so both bots stay aligned on the configured
    // streaming transcriber (AWS Transcribe Streaming / Azure Speech
    // Streaming). Per-peer architecture means each session sees one
    // speaker so we set the same single-speaker AWS knobs Teams uses
    // in floor mode (no speaker labelling, low partial-stability →
    // better final accuracy).
    const resolved = adapterFactory
      ? { provider: 'custom', factory: adapterFactory }
      : pickAsrAdapterFactory({
          provider: asrProvider,
          extraAwsOpts: { partialResultsStability: 'low', enableSpeakerLabel: false },
        });
    this.asrProvider = resolved.provider;
    this.logger.info?.('[gmeet.capture] asr provider', { provider: this.asrProvider });

    this.pool = new PerParticipantStreamPool({
      logger: this.logger,
      region,
      languageCode,
      sampleRate,
      maxSessions,
      meetingStartMs: this.meetingStartMs,
      adapterFactory: resolved.factory,
      onSegment: (seg) => this._emitSegment(seg),
      onError: (err, pid) => {
        this.logger.warn?.('[gmeet.capture] pool error', { pid, err: err?.message });
      },
    });

    this.stats = {
      framesIn: 0,
      framesPushed: 0,
      framesDropped: 0,
      tracksHooked: 0,   // # of remote audio receivers the page hooked
      segmentsEmitted: 0,
      segmentsHallucinated: 0,
    };
  }

  start() { this.pool.start(); }

  async expose(page) {
    if (this._exposed) return;
    await page.exposeBinding(
      '__gmeetBridgeOnPcmChunk',
      async (_source, payload) => {
        try { this._onChunk(payload); }
        catch (e) { this.logger.warn?.('[gmeet.capture] chunk failed', e?.message); }
      },
    );
    // Page calls this once per remote audio receiver it hooks. Lets the
    // run-loop watchdog tell a deaf capture (no track ever arrived, e.g. a
    // rejoin where Meet didn't deliver media) from a quiet-but-connected one.
    await page.exposeFunction('__gmeetBridgeOnTrackHooked', async () => {
      this.stats.tracksHooked += 1;
    });
    // Captions-mode binding. Page-realm captionsScraperScript fires
    // (speaker, text, ts) for each new caption update; we treat each
    // as a ready-to-publish transcript segment — Google's own ASR is
    // the source. Always exposed (idempotent) so a runtime mode flip
    // can dual-stream if needed; no-op when captions mode isn't on.
    await page.exposeFunction('__gmeetBridgeOnCaption', async (payload) => {
      try { await this._onCaption(payload); }
      catch (e) { this.logger.warn?.('[gmeet.capture] caption failed', e?.message); }
    });
    // Also expose the bot name into the page so perPeerCaptureScript
    // can skip the bot's own self-tile during DOM correlation.
    if (this.botName) {
      try {
        await page.evaluate(
          (name) => { window.__gmeetBotName = name; },
          this.botName,
        );
      } catch (_) { /* ignore — script may inject this later */ }
    }
    this._exposed = true;
  }

  // Caption-driven segment publish. Mirrors Teams' captureBridge
  // _onCaption: Google's caption text IS the transcript. Speaker
  // attribution is direct from the caption block when it had a name
  // node; we fall back to rosterWatcher for blocks where the in-page
  // scraper couldn't isolate a name (older Meet UI revs put speaker
  // outside the row, or the row was unsegmented).
  async _onCaption({ speaker, text, ts_ms } = {}) {
    if (!text) return;
    const ts = Number(ts_ms) || Date.now();

    // Hallucination filter — captions can also include cold-open phrases
    // ("[Music]", "thank you" loops) when the room is silent. Same
    // filter Teams uses.
    const drop = shouldDrop({ text });
    if (drop.drop) {
      this.stats.captionHallucinated = (this.stats.captionHallucinated || 0) + 1;
      return;
    }

    // Skip the bot's own captions if Meet ever stamps them. Meet uses
    // "You" as the speaker label for the LOCAL participant's captions
    // — that's always the bot, regardless of mute state, so drop those
    // unconditionally (defense-in-depth in case mic muting fails).
    if (speaker && (this._isBot(speaker) || /^you$/i.test(speaker.trim()))) return;

    let resolvedSpeaker = speaker || null;
    let attributionConfidence = speaker ? 'caption_author' : 'unknown';

    // If the page-realm scraper couldn't isolate a name, walk
    // rosterWatcher's history of who was speaking around the caption
    // timestamp. Captions arrive with ~1-2 s lag from audio, so widen
    // the window to that range.
    if (!resolvedSpeaker && this.rosterWatcher) {
      try {
        if (typeof this.rosterWatcher.getActiveSpeakerInWindow === 'function') {
          const active = this.rosterWatcher.getActiveSpeakerInWindow(ts - 4_000, ts);
          if (active && !this._isBot(active)) {
            resolvedSpeaker = active;
            attributionConfidence = 'roster_history';
          }
        }
      } catch (_) { /* ignore */ }
      if (!resolvedSpeaker && typeof this.rosterWatcher.snapshot === 'function') {
        try {
          const snap = this.rosterWatcher.snapshot();
          const list = Array.isArray(snap?.list) ? snap.list : [];
          const humans = list
            .map((e) => (typeof e === 'string' ? { name: e, speaking: false } : e))
            .filter((e) => e?.name && !this._isBot(e.name));
          const speakingNow = humans.filter((e) => e.speaking);
          if (speakingNow.length === 1) {
            resolvedSpeaker = speakingNow[0].name;
            attributionConfidence = 'roster_active';
          } else if (humans.length === 1) {
            resolvedSpeaker = humans[0].name;
            attributionConfidence = 'roster_solo';
          }
        } catch (_) { /* ignore */ }
      }
    }
    if (resolvedSpeaker) this._lastBoundSpeaker = resolvedSpeaker;
    if (!resolvedSpeaker) resolvedSpeaker = this._lastBoundSpeaker || 'Unknown speaker';
    if (!speaker && resolvedSpeaker !== 'Unknown speaker' && attributionConfidence === 'unknown') {
      attributionConfidence = 'last_known_speaker';
    }

    this._captionSeq = (this._captionSeq || 0) + 1;
    const segment = Object.freeze({
      id: `gmeet_caption_${this._captionSeq}_${ts}`,
      track_id: null,
      peer_id: null,
      speaker: resolvedSpeaker,
      speaker_id: resolvedSpeaker !== 'Unknown speaker'
        ? speakerSlug(resolvedSpeaker)
        : `gmeet_caption_${this._captionSeq}`,
      attribution_confidence: attributionConfidence,
      // Bound the displayed end-time by text length (captions don't
      // carry per-word timestamps). 60 ms/char yields a roughly natural
      // reading pace within a 1-8 s envelope.
      start_ms: ts,
      end_ms: ts + Math.max(1_000, Math.min(8_000, text.length * 60)),
      sample_rate: null,
      language: null,
      provider: 'gmeet_captions',
      kind: 'caption',
      text,
      words: [],
      diarization: {
        participant_id: null,
        participant_name: resolvedSpeaker,
        result_id: null,
      },
      platform: 'googlemeet',
    });
    this.stats.captionsPublished = (this.stats.captionsPublished || 0) + 1;
    this.logger.info?.('[gmeet.capture] caption', {
      speaker: resolvedSpeaker, attribution: attributionConfidence, len: text.length,
    });
    this._recordAudioAttribution(resolvedSpeaker);
    try { await this.onSegment(segment); }
    catch (err) { this.logger.warn?.('[gmeet.capture] caption publish failed', err?.message); }
  }

  _onChunk(payload) {
    if (!payload) return;
    this.stats.framesIn += 1;

    const pid = String(payload.pid || payload.participant_id || payload.csrc_source || payload.track_id || '').trim();
    if (!pid) { this.stats.framesDropped += 1; return; }

    const pcmBuffer = payload.pcm_b64
      ? Buffer.from(payload.pcm_b64, 'base64')
      : null;
    if (!pcmBuffer || pcmBuffer.length === 0) { this.stats.framesDropped += 1; return; }

    // Track the latest known display name for this pid. The page-realm
    // correlator may upgrade `name` from null to a real string after a
    // few seconds of speaking; we always trust the most recent value.
    const incomingName = (payload.name || '').toString().trim() || null;
    if (incomingName) this._pidNames.set(pid, incomingName);

    // Bot self-tile guardrail: the page-realm script also filters but
    // a fresh chunk could slip through before bot name is propagated.
    if (incomingName && this._isBot(incomingName)) {
      this.stats.framesDropped += 1;
      return;
    }

    // Skip near-silent frames as a last-ditch filter (the page-realm
    // script also applies this; belt-and-braces in case threshold is
    // tuned independently). RMS threshold matches Teams.
    const rms = Number.isFinite(payload.rms) ? Number(payload.rms) : 0;
    if (rms > 0 && rms < 0.0008) {
      this.stats.framesDropped += 1;
      return;
    }

    this.pool.pushFrame({
      pid,
      name: this._pidNames.get(pid) || null,
      pcm: pcmBuffer,
      ts_ms: Number(payload.ts_ms) || Date.now(),
    });
    this.stats.framesPushed += 1;
  }

  _emitSegment(rawSeg) {
    if (!rawSeg) return;
    // PerParticipantStreamPool emits segments shaped:
    //   { provider, is_final, start_ms, end_ms, text, words, raw,
    //     participant_id, participant_name }
    if (!rawSeg.text) return;

    // Hallucination filter — same one Teams uses. Drop AWS Transcribe's
    // common cold-open hallucinations ("Thank you for watching", ".").
    const drop = shouldDrop({ text: rawSeg.text });
    if (drop.drop) {
      this.stats.segmentsHallucinated += 1;
      return;
    }

    const pid = rawSeg.participant_id || 'unknown';
    let attributionConfidence = pid === 'unknown' ? 'unknown' : 'per_peer';

    // Cascading speaker resolution. The page-realm correlator may not
    // have locked the binding by the time AWS emits the first final on
    // a cold-start pid (`track-XXXX` / `csrc-XXXX`). Walk these signals
    // in priority order — first hit wins:
    //
    //   1. _pidNames map (page-realm correlation already locked AND we
    //      saw a frame with the locked name — most authoritative)
    //   2. rawSeg.participant_name (set when the page-realm script
    //      stamped the name on the inbound chunk)
    //   3. rosterWatcher.getActiveSpeakerInWindow over the segment's
    //      wall-clock window — handles the typical cold-start case
    //   4. rosterWatcher.snapshot() — sole human marked as currently
    //      speaking (catches the moment of first utterance before any
    //      history accumulates)
    //   5. rosterWatcher.snapshot() — sole human in the roster (1:1
    //      attribution by elimination, mirrors Teams' roster_solo path)
    //   6. Last-bound speaker on this bridge (any prior locked name)
    //   7. The opaque pid itself (last resort, never reached in
    //      practice with a populated roster)
    //
    // Whichever non-pid name wins is cached into _pidNames so
    // subsequent segments for the same pid reuse it without retrying
    // the cascade.
    const isColdStartPid = /^(track-|csrc-)/.test(pid);
    let name = this._pidNames.get(pid) || rawSeg.participant_name || null;

    if ((!name || name === pid) && this.rosterWatcher && isColdStartPid) {
      const startMs = Number(rawSeg.start_ms);
      const endMs = Number(rawSeg.end_ms) || (startMs + 5_000);

      // Tier 3 — history window
      try {
        if (typeof this.rosterWatcher.getActiveSpeakerInWindow === 'function') {
          const active = this.rosterWatcher.getActiveSpeakerInWindow(startMs, endMs);
          if (active && !this._isBot(active)) {
            name = active;
            attributionConfidence = 'roster_history';
          }
        }
      } catch (_) { /* ignore */ }

      // Tier 4-5 — current snapshot
      if (!name && typeof this.rosterWatcher.snapshot === 'function') {
        try {
          const snap = this.rosterWatcher.snapshot();
          const list = Array.isArray(snap?.list) ? snap.list : [];
          const humans = list
            .map((e) => (typeof e === 'string' ? { name: e, speaking: false } : e))
            .filter((e) => e?.name && !this._isBot(e.name));
          // Tier 4: sole speaking human
          const speaking = humans.filter((e) => e.speaking);
          if (speaking.length === 1) {
            name = speaking[0].name;
            attributionConfidence = 'roster_active';
          } else if (humans.length === 1) {
            // Tier 5: sole human in the roster
            name = humans[0].name;
            attributionConfidence = 'roster_solo';
          }
        } catch (_) { /* ignore */ }
      }

      // Tier 6 — last-bound speaker on this bridge (any prior real name).
      if (!name && this._lastBoundSpeaker) {
        name = this._lastBoundSpeaker;
        attributionConfidence = 'last_known_speaker';
      }

      if (name) this._pidNames.set(pid, name);  // remember for subsequent segments
    }

    if (!name) name = pid === 'unknown' ? 'Unknown speaker' : pid;
    // Track the last successfully-attributed speaker so future
    // cold-start segments can fall through to it (better than emitting
    // a synthetic pid as the speaker).
    if (name && name !== 'Unknown speaker' && !isColdStartPid) {
      this._lastBoundSpeaker = name;
    } else if (name && !this._isBot(name) && !/^(track-|csrc-)/.test(name)) {
      this._lastBoundSpeaker = name;
    }

    const resultId = rawSeg.raw?.result_id || `r${Date.now()}`;
    const segment = Object.freeze({
      id: `gmeet_${pid}_${resultId}_${rawSeg.start_ms || 0}`,
      track_id: null,
      peer_id: null,
      speaker: name,
      speaker_id: name && name !== 'Unknown speaker' ? speakerSlug(name) : `gmeet_${pid}`,
      attribution_confidence: attributionConfidence,
      start_ms: Number(rawSeg.start_ms) || Date.now(),
      end_ms: Number(rawSeg.end_ms) || (Number(rawSeg.start_ms) + 1_000),
      sample_rate: 16_000,
      language: null,
      provider: rawSeg.provider || 'aws_transcribe',
      kind: rawSeg.is_final ? 'final' : 'partial',
      text: rawSeg.text,
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
      platform: 'googlemeet',
    });

    if (rawSeg.is_final) this.stats.segmentsEmitted += 1;
    if (rawSeg.is_final) this._recordAudioAttribution(name);
    Promise.resolve(this.onSegment(segment))
      .catch((err) => this.logger.warn?.('[gmeet.capture] onSegment failed', err?.message));
  }

  _recordAudioAttribution(speakerName) {
    if (!speakerName || typeof speakerName !== 'string') return;
    if (this._isBot(speakerName)) return;
    if (speakerName === 'Unknown speaker') return;
    if (/^Speaker\s*\d+$/i.test(speakerName)) return;
    if (/^(track-|csrc-)/i.test(speakerName)) return;  // synthetic pid not a real name
    this._lastAudioAttributedSpeaker = speakerName;
    this._lastAudioAttributedTs = Date.now();
  }

  getRecentAttributedSpeaker() {
    if (!this._lastAudioAttributedSpeaker) return null;
    return {
      name: this._lastAudioAttributedSpeaker,
      tsMs: this._lastAudioAttributedTs,
    };
  }

  _isBot(name) {
    if (!this.botName || !name) return false;
    const a = String(name).trim().toLowerCase();
    const b = String(this.botName).trim().toLowerCase();
    if (a === b) return true;
    // Substring matching is intentional for "Test Bot" → "Test"/"Bot"
    // variants, but only when BOTH sides are long enough that the
    // substring isn't a coincidence. A 1-2 char name like "Al" or "A"
    // is almost guaranteed to appear inside a longer bot name and
    // would cause real participants to be silently filtered.
    if (a.length < 3 || b.length < 3) return false;
    return a.includes(b) || b.includes(a);
  }

  async stop() {
    try { await this.pool.stop(); } catch (e) {
      this.logger.warn?.('[gmeet.capture] pool stop failed', e?.message);
    }
  }
}

module.exports = { CaptureBridge };
