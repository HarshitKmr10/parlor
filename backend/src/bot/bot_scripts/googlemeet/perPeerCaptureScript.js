'use strict';

// Page-realm per-peer audio capture for Google Meet.
//
// Phase 0 probe finding (locked verdict 2A): Meet ships ONE audio
// RTCRtpReceiver per remote participant. The receiver's track always
// carries that one participant's audio — no CSRC routing required.
// Each receiver also exposes a stable per-participant CSRC source ID
// (the non-`42` entry in getContributingSources()), useful as a stable
// pid even when a tile re-mounts.
//
// What this script does:
//   1. Hook RTCPeerConnection so every audio receiver becomes visible.
//   2. For each receiver, tap a MediaStreamTrackProcessor → resample to
//      16 kHz mono → 16-bit PCM → base64 → ship to Node via
//      window.__gmeetBridgeOnPcmChunk.
//   3. Per receiver, learn `track.id → { csrcSource, displayName,
//      participantId }` by correlating audio activity with the DOM
//      speaker class. The correlation runs in-page so the Node bridge
//      receives already-attributed frames.
//
// Frame payload shipped to Node:
//   { pid, name, participant_id, csrc_source, pcm_b64, sample_rate,
//     ts_ms, rms, track_id }
// where `pid` is the stable identifier the PerParticipantStreamPool
// keys on. We default `pid = participant_id` once correlated, falling
// back to `pid = csrc_source` (also stable per receiver) before the
// first DOM correlation, and `pid = "track-${track.id}"` as a last
// resort during cold start.

const SCRIPT = `
(() => {
  if (window.__gmeetCaptureInstalled) return;
  window.__gmeetCaptureInstalled = true;

  const TAG = '[gmeet.capture]';
  const TARGET_SR = 16_000;
  const FRAME_EMIT_MS = 100;
  const POLL_MS = 200;
  const STATS_LOG_MS = 10_000;
  const CORRELATION_LOCK_VOTES = 3;
  const SPEAKING_CLASSES = ['Oaajhc', 'HX2H7', 'wEsLMd', 'OgVli'];
  const NAME_SELECTORS = ['span.notranslate', '[data-self-name]', '.zWGUib'];
  const CSRC_SENTINEL = 42;  // non-participant placeholder, ignore

  function log() { try { console.log.apply(console, [TAG].concat(Array.from(arguments))); } catch (_) {} }
  function warn() { try { console.warn.apply(console, [TAG].concat(Array.from(arguments))); } catch (_) {} }

  // ─── Receiver registry ────────────────────────────────────────────────
  const receivers = new Map();   // trackId -> { receiver, track, binding, lastEmitTs, accum }
  const seenTracks = new WeakSet();

  function bindingFor(trackId) {
    let r = receivers.get(trackId);
    if (!r) return null;
    return r.binding;
  }

  function defaultBinding(trackId) {
    return {
      pid: 'track-' + trackId,
      participantId: null,
      csrcSource: null,
      displayName: null,
      votes: Object.create(null), // 'pidCandidate|displayName' -> count
      locked: false,
    };
  }

  function castVote(binding, csrcSource, participantId, displayName) {
    if (binding.locked) return;
    if (!participantId && !displayName && !csrcSource) return;
    const key = (participantId || '') + '|' + (displayName || '') + '|' + (csrcSource || '');
    binding.votes[key] = (binding.votes[key] || 0) + 1;
    if (binding.votes[key] >= CORRELATION_LOCK_VOTES) {
      binding.participantId = participantId || binding.participantId;
      binding.displayName = displayName || binding.displayName;
      binding.csrcSource = csrcSource || binding.csrcSource;
      binding.pid = binding.participantId || (binding.csrcSource ? 'csrc-' + binding.csrcSource : binding.pid);
      binding.locked = true;
      log('binding locked', JSON.stringify({
        track_id_short: (binding.pid || '').slice(0,12),
        participant_id: binding.participantId,
        display_name: binding.displayName,
        csrc_source: binding.csrcSource,
      }));
    }
  }

  // ─── DOM speaker probe ────────────────────────────────────────────────
  function findName(tile) {
    for (const sel of NAME_SELECTORS) {
      const el = tile.querySelector(sel);
      if (el && el.textContent) {
        const txt = el.textContent.trim();
        if (txt) return txt;
      }
    }
    return tile.getAttribute('data-self-name') || null;
  }

  function tileSpeaking(tile) {
    for (const cls of SPEAKING_CLASSES) {
      if (tile.querySelector('.' + cls)) return true;
      if (tile.classList && tile.classList.contains(cls)) return true;
    }
    return false;
  }

  function speakingTiles() {
    const tiles = Array.from(document.querySelectorAll('[data-participant-id]'));
    const out = new Map();  // participantId -> name
    for (const tile of tiles) {
      const pid = tile.getAttribute('data-participant-id');
      if (!pid) continue;
      if (!tileSpeaking(tile)) continue;
      const name = findName(tile);
      if (!name) continue;
      // Skip the bot's own self-tile — when our outbound mic pushes
      // anything (even silence) the local tile lights up and we don't
      // want to bind a remote receiver to ourselves.
      if (window.__gmeetBotName && name.trim().toLowerCase() === String(window.__gmeetBotName).trim().toLowerCase()) continue;
      if (!out.has(pid)) out.set(pid, name);
    }
    return out;
  }

  // ─── Correlation poll: who is speaking + which receivers carry audio ──
  let pollTimer = null;
  let pollTicks = 0;
  function startPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(() => {
      pollTicks++;
      const now = Date.now();
      const recentCutoff = now - 250;

      // Find receivers actively delivering audio right now.
      const active = [];   // [{ trackId, csrcSource, audioLevel }]
      for (const [trackId, entry] of receivers.entries()) {
        const r = entry.receiver;
        let csrcs = [];
        let ssrcs = [];
        try { csrcs = r.getContributingSources ? r.getContributingSources() : []; } catch (_) {}
        try { ssrcs = r.getSynchronizationSources ? r.getSynchronizationSources() : []; } catch (_) {}
        // The non-sentinel CSRC is the stable per-participant ID for this
        // receiver — capture it even when the receiver is silent so the
        // binding survives a quiet stretch.
        for (const c of csrcs) {
          if (c.source !== CSRC_SENTINEL && c.source != null) {
            entry.binding.csrcSource = entry.binding.csrcSource || c.source;
          }
        }
        // audioLevel is in [0, 1]; treat anything > 0.005 within the
        // last 250 ms as "actively speaking on this receiver". Tune if
        // needed — error here just delays correlation, doesn't break it.
        let recentMax = 0;
        for (const s of ssrcs) {
          if (s.timestamp >= recentCutoff && Number.isFinite(s.audioLevel)) {
            if (s.audioLevel > recentMax) recentMax = s.audioLevel;
          }
        }
        for (const c of csrcs) {
          if (c.timestamp >= recentCutoff && Number.isFinite(c.audioLevel)) {
            if (c.audioLevel > recentMax) recentMax = c.audioLevel;
          }
        }
        if (recentMax > 0.005) {
          active.push({ trackId, csrcSource: entry.binding.csrcSource, audioLevel: recentMax });
        }
      }

      const speaking = speakingTiles();
      // Cast votes only when there is exactly one active receiver AND
      // exactly one DOM-speaking tile — otherwise we can't tell which
      // pairing is correct. Both sides being singletons is a strong
      // attribution signal.
      if (active.length === 1 && speaking.size === 1) {
        const entry = receivers.get(active[0].trackId);
        if (entry && !entry.binding.locked) {
          const [participantId, name] = speaking.entries().next().value;
          castVote(entry.binding, active[0].csrcSource, participantId, name);
        }
      }
    }, POLL_MS);
  }

  // ─── RTCPeerConnection patch ──────────────────────────────────────────
  const NativePC = window.RTCPeerConnection;
  if (!NativePC) { warn('no RTCPeerConnection; aborting'); return; }
  function PatchedPC() {
    const pc = new NativePC(...arguments);
    pc.addEventListener('track', function (event) {
      try {
        if (event.track && event.track.kind === 'audio') {
          handleAudioTrack(event);
        }
      } catch (e) { warn('track handler failed', e && e.message); }
    });
    return pc;
  }
  PatchedPC.prototype = NativePC.prototype;
  Object.setPrototypeOf(PatchedPC, NativePC);
  window.RTCPeerConnection = PatchedPC;

  // ─── Audio frame extraction ───────────────────────────────────────────
  function resampleFloat32(input, fromRate, toRate) {
    if (fromRate === toRate) return input;
    const ratio = fromRate / toRate;
    const len = Math.floor(input.length / ratio);
    const out = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      const idx = i * ratio;
      const i0 = Math.floor(idx);
      const i1 = Math.min(i0 + 1, input.length - 1);
      const frac = idx - i0;
      out[i] = input[i0] * (1 - frac) + input[i1] * frac;
    }
    return out;
  }

  function floatToPcm16(input) {
    const out = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out;
  }

  function pcm16ToBase64(pcm16) {
    const bytes = new Uint8Array(pcm16.buffer, pcm16.byteOffset, pcm16.byteLength);
    let bin = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(bin);
  }

  function rmsOf(pcm) {
    let sumSq = 0;
    for (let i = 0; i < pcm.length; i++) sumSq += pcm[i] * pcm[i];
    return Math.sqrt(sumSq / Math.max(1, pcm.length));
  }

  let stats = { framesIn: 0, framesEmitted: 0, framesDropped: 0, lastStatsLog: 0 };

  async function handleAudioTrack(event) {
    if (!event.track || seenTracks.has(event.track)) return;
    if (!event.receiver) return;
    seenTracks.add(event.track);
    const trackId = event.track.id;

    const entry = {
      receiver: event.receiver,
      track: event.track,
      binding: defaultBinding(trackId),
    };
    receivers.set(trackId, entry);
    log('intercepting audio receiver', trackId);
    // Tell Node a real audio receiver was hooked. This is the signal the
    // run-loop watchdog uses to distinguish "no audio track ever arrived"
    // (capture failed to attach — e.g. a rejoin where Meet didn't deliver
    // media) from "track hooked but silent" (a legitimately quiet meeting).
    try {
      if (typeof window.__gmeetBridgeOnTrackHooked === 'function') {
        window.__gmeetBridgeOnTrackHooked(trackId);
      }
    } catch (_) { /* best-effort */ }

    if (typeof MediaStreamTrackProcessor !== 'function') {
      warn('MediaStreamTrackProcessor unavailable; cannot capture');
      return;
    }
    let processor;
    try { processor = new MediaStreamTrackProcessor({ track: event.track }); }
    catch (e) { warn('processor ctor failed', e && e.message); return; }

    const samplesPerFrame = Math.round(TARGET_SR * FRAME_EMIT_MS / 1000);
    let accum = new Float32Array(0);
    const reader = processor.readable.getReader();
    try {
      while (true) {
        const { value: frame, done } = await reader.read();
        if (done) break;
        if (!frame) continue;
        try {
          const numChannels = frame.numberOfChannels;
          const numSamples = frame.numberOfFrames;
          const inputRate = frame.sampleRate;
          const mono = new Float32Array(numSamples);
          if (numChannels > 1) {
            const channel = new Float32Array(numSamples);
            for (let c = 0; c < numChannels; c++) {
              try { frame.copyTo(channel, { planeIndex: c }); } catch (_) { continue; }
              for (let i = 0; i < numSamples; i++) mono[i] += channel[i];
            }
            for (let i = 0; i < numSamples; i++) mono[i] /= numChannels;
          } else {
            try { frame.copyTo(mono, { planeIndex: 0 }); } catch (_) {}
          }
          const resampled = inputRate === TARGET_SR ? mono : resampleFloat32(mono, inputRate, TARGET_SR);
          if (accum.length === 0) {
            accum = resampled;
          } else {
            const merged = new Float32Array(accum.length + resampled.length);
            merged.set(accum, 0);
            merged.set(resampled, accum.length);
            accum = merged;
          }
          while (accum.length >= samplesPerFrame) {
            const chunk = accum.subarray(0, samplesPerFrame);
            const rest = accum.subarray(samplesPerFrame);
            const rms = rmsOf(chunk);
            const pcm16 = floatToPcm16(chunk);
            const b64 = pcm16ToBase64(pcm16);
            stats.framesIn++;
            const binding = entry.binding;
            // Skip emission entirely on near-silent frames so we don't
            // open ASR sessions for receivers whose participant hasn't
            // started speaking yet. Threshold matches Teams' RMS floor.
            if (rms < 0.0008) {
              stats.framesDropped++;
            } else if (typeof window.__gmeetBridgeOnPcmChunk === 'function') {
              try {
                window.__gmeetBridgeOnPcmChunk({
                  pid: binding.pid,
                  name: binding.displayName,
                  participant_id: binding.participantId,
                  csrc_source: binding.csrcSource,
                  pcm_b64: b64,
                  sample_rate: TARGET_SR,
                  ts_ms: Date.now(),
                  rms,
                  track_id: trackId,
                });
                stats.framesEmitted++;
              } catch (e) { warn('bridge call failed', e && e.message); }
            }
            const carry = new Float32Array(rest.length);
            carry.set(rest, 0);
            accum = carry;
          }
          // Periodic stats log
          if (Date.now() - stats.lastStatsLog >= STATS_LOG_MS) {
            stats.lastStatsLog = Date.now();
            log('stats', JSON.stringify({
              receivers: receivers.size,
              poll_ticks: pollTicks,
              frames_in: stats.framesIn,
              frames_emitted: stats.framesEmitted,
              frames_dropped: stats.framesDropped,
              locked_bindings: Array.from(receivers.values()).filter((e) => e.binding.locked).length,
            }));
          }
        } finally {
          try { frame.close(); } catch (_) {}
        }
      }
    } catch (e) {
      warn('reader loop failed', e && e.message);
    } finally {
      try { reader.releaseLock(); } catch (_) {}
      log('reader closed', trackId);
      receivers.delete(trackId);
    }
  }

  startPolling();

  // Diagnostics handle for test harnesses.
  window.__gmeetSnapshot = () => {
    const out = [];
    for (const [trackId, entry] of receivers.entries()) {
      out.push({
        trackId,
        pid: entry.binding.pid,
        participantId: entry.binding.participantId,
        displayName: entry.binding.displayName,
        csrcSource: entry.binding.csrcSource,
        locked: entry.binding.locked,
      });
    }
    return { receivers: out, stats: { ...stats }, pollTicks };
  };

  log('per-peer capture installed');
})();
`;

module.exports = { SCRIPT };
