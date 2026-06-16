'use strict';

// Page-realm script for the `floor_owner` attribution mode.
//
// Routes raw CSRC presence directly into per-frame ownership decisions.
// No 5-of-5 debounce, no speech-interval store, no 2 s lookback.
//
// At each ~100 ms PCM frame we query the CSRC observation nearest the
// frame's timestamp and apply this rule:
//
//   - 0 attributed pids        -> drop the frame (counted as framesUnknown)
//   - exactly 1 attributed pid -> route only after the source is stable, or
//                                after it was already qualified earlier
//   - >1 attributed pids       -> stable floorOwner if present; else a
//                                qualified lastFrameOwner; else a candidate
//                                that becomes stable in the live lookahead
//
// floorOwner persists across silences. A new solo source starts provisional:
// it can receive current frames only after enough stable solo evidence, and
// it cannot win ambiguous overlap before that. This prevents noise-first
// capture such as Noise -> Noise+Speaker -> Speaker.
//
// Config arrives via window.__teamsFloorOwnerConfig (set by the Node side
// before this script runs). Bindings:
//   __teamsFloorOwnerOnAttributedFrame(payload)
//   __teamsFloorOwnerOnHealth(payload)
//   __teamsFloorOwnerSnapshot()  — diagnostics only

const SCRIPT = `
(() => {
  if (window.__teamsFloorOwnerInstalled) return;
  window.__teamsFloorOwnerInstalled = true;

  const TAG = '[teams.floor]';
  // Teams' WebRTC audio is 48 kHz Opus natively. Forwarding at 48 kHz
  // preserves all the spectral information the ASR model is trained on;
  // downsampling to 16 kHz here would waste 2/3 of the consonant detail.
  const TARGET_SR = 48_000;
  const POLL_MS = 100;
  const FRAME_EMIT_MS = 100;
  const STATS_LOG_MS = 10_000;
  const CSRC_EVENT_WINDOW_MS = 5_000;
  const CSRC_LOOKUP_TOLERANCE_MS = 100;

  const cfg = window.__teamsFloorOwnerConfig || {};
  const QUEUE_LAG_MS = Number(cfg.resolveLagMs || cfg.queueLagMs) || 600;
  const FLOOR_OWNER_MIN_SOLO_MS = Number(cfg.floorOwnerMinSoloMs) || 300;
  const PRE_ROLL_MS = Number(cfg.preRollMs) || 300;
  const noiseNamePatternSource = typeof cfg.noiseNamePattern === 'string'
    ? cfg.noiseNamePattern
    : '\\\\bnoise\\\\b|\\\\bbackground\\\\b|\\\\bambient\\\\b';
  let noiseNamePattern = null;
  if (noiseNamePatternSource) {
    try { noiseNamePattern = new RegExp(noiseNamePatternSource, 'i'); }
    catch (_) { noiseNamePattern = /\\bnoise\\b|\\bbackground\\b|\\bambient\\b/i; }
  }

  function log() { try { console.log.apply(console, [TAG].concat(Array.from(arguments))); } catch (_) {} }
  function warn() { try { console.warn.apply(console, [TAG].concat(Array.from(arguments))); } catch (_) {} }

  // ─── Floor-owner state ──────────────────────────────────────────────────
  let floorOwner = null;
  let soloSpeaker = null;
  let soloRunStartMs = null;
  let lastFrameOwner = null;
  let provisionalOwner = null;
  let provisionalStartMs = null;
  const qualifiedSpeakers = new Set();

  // ─── Raw CSRC event store ───────────────────────────────────────────────
  // One entry per poll tick: { ts_ms, pids:Set<string> }. Trimmed to the
  // last CSRC_EVENT_WINDOW_MS so memory stays bounded over a long meeting.
  const csrcEvents = [];
  const participantNames = Object.create(null);

  function recordCsrcEvent(ts_ms, pids) {
    csrcEvents.push({ ts_ms: ts_ms, pids: pids });
    const cutoff = ts_ms - CSRC_EVENT_WINDOW_MS;
    while (csrcEvents.length > 0 && csrcEvents[0].ts_ms < cutoff) csrcEvents.shift();
  }

  function csrcSetAt(ts_ms) {
    let best = null, bestDelta = Infinity;
    for (let i = csrcEvents.length - 1; i >= 0; i--) {
      const ev = csrcEvents[i];
      const d = Math.abs(ev.ts_ms - ts_ms);
      if (d < bestDelta) { best = ev; bestDelta = d; }
      if (ev.ts_ms < ts_ms - CSRC_LOOKUP_TOLERANCE_MS && bestDelta <= CSRC_LOOKUP_TOLERANCE_MS) break;
    }
    return (best && bestDelta <= CSRC_LOOKUP_TOLERANCE_MS) ? best.pids : null;
  }

  function sortedPids(set) {
    return Array.from(set || []).sort();
  }

  function isNoiseLikePid(pid) {
    if (!pid || !noiseNamePattern) return false;
    const name = participantNames[pid] || '';
    return noiseNamePattern.test(name);
  }

  function rememberProvisional(pid, ts_ms) {
    if (provisionalOwner !== pid) {
      provisionalOwner = pid;
      provisionalStartMs = ts_ms;
    }
  }

  function clearProvisional(pid) {
    if (!pid || provisionalOwner === pid) {
      provisionalOwner = null;
      provisionalStartMs = null;
    }
  }

  function promoteFloorOwner(pid) {
    if (!pid || isNoiseLikePid(pid)) return;
    floorOwner = pid;
    qualifiedSpeakers.add(pid);
    clearProvisional(pid);
  }

  function soloRunBeforeMs(pid, ts_ms, windowMs) {
    let runStart = null;
    let lastTs = null;
    for (let i = csrcEvents.length - 1; i >= 0; i--) {
      const ev = csrcEvents[i];
      if (ev.ts_ms > ts_ms) continue;
      if (ev.ts_ms < ts_ms - windowMs) break;
      if (ev.pids && ev.pids.size === 1 && ev.pids.has(pid)) {
        if (lastTs != null && lastTs - ev.ts_ms > POLL_MS * 2) break;
        runStart = ev.ts_ms;
        if (lastTs == null) lastTs = ev.ts_ms;
      } else if (lastTs != null) {
        break;
      }
    }
    if (runStart == null || lastTs == null) return 0;
    return Math.max(0, lastTs - runStart + POLL_MS);
  }

  function nextSoloRunMs(pid, ts_ms, windowMs) {
    let runStart = null;
    let lastTs = null;
    let best = 0;
    for (let i = 0; i < csrcEvents.length; i++) {
      const ev = csrcEvents[i];
      if (ev.ts_ms < ts_ms) continue;
      if (ev.ts_ms > ts_ms + windowMs) break;
      if (ev.pids && ev.pids.size === 1 && ev.pids.has(pid)) {
        if (runStart == null || (lastTs != null && ev.ts_ms - lastTs > POLL_MS * 2)) {
          runStart = ev.ts_ms;
        }
        lastTs = ev.ts_ms;
        best = Math.max(best, lastTs - runStart + POLL_MS);
      } else if (runStart != null) {
        runStart = null;
        lastTs = null;
      }
    }
    return best;
  }

  function stableSoloEvidenceMs(pid, ts_ms) {
    if (!pid || isNoiseLikePid(pid)) return 0;
    return soloRunBeforeMs(pid, ts_ms, QUEUE_LAG_MS + PRE_ROLL_MS) +
      nextSoloRunMs(pid, ts_ms, QUEUE_LAG_MS + PRE_ROLL_MS);
  }

  function bestStableCandidate(set, ts_ms) {
    let bestPid = null;
    let bestScore = 0;
    const pids = sortedPids(set);
    for (let i = 0; i < pids.length; i++) {
      const pid = pids[i];
      if (isNoiseLikePid(pid)) continue;
      const score = stableSoloEvidenceMs(pid, ts_ms);
      if (score >= FLOOR_OWNER_MIN_SOLO_MS && score > bestScore) {
        bestPid = pid;
        bestScore = score;
      }
    }
    return bestPid;
  }

  function onlyNonNoiseCandidate(set) {
    const nonNoise = sortedPids(set).filter(function (pid) { return !isNoiseLikePid(pid); });
    return nonNoise.length === 1 ? nonNoise[0] : null;
  }

  function routeWithFloorOwner(ts_ms) {
    const set = csrcSetAt(ts_ms);
    if (!set || set.size === 0) {
      soloSpeaker = null; soloRunStartMs = null;
      clearProvisional();
      return null;
    }
    if (set.size === 1) {
      const pid = set.values().next().value;
      if (soloSpeaker !== pid) {
        soloSpeaker = pid;
        soloRunStartMs = ts_ms;
      } else if (soloRunStartMs != null && ts_ms - soloRunStartMs >= FLOOR_OWNER_MIN_SOLO_MS) {
        promoteFloorOwner(pid);
      }
      if (qualifiedSpeakers.has(pid) || floorOwner === pid) return pid;
      if (stableSoloEvidenceMs(pid, ts_ms) >= FLOOR_OWNER_MIN_SOLO_MS) {
        promoteFloorOwner(pid);
        return pid;
      }
      rememberProvisional(pid, ts_ms);
      return null;
    }
    // overlap — ambiguous frames never extend a solo run
    soloSpeaker = null; soloRunStartMs = null;
    if (floorOwner && set.has(floorOwner) && !isNoiseLikePid(floorOwner)) return floorOwner;
    if (lastFrameOwner && set.has(lastFrameOwner) &&
        qualifiedSpeakers.has(lastFrameOwner) && !isNoiseLikePid(lastFrameOwner)) {
      return lastFrameOwner;
    }
    const stable = bestStableCandidate(set, ts_ms);
    if (stable) {
      promoteFloorOwner(stable);
      return stable;
    }
    const loneReal = onlyNonNoiseCandidate(set);
    if (loneReal) return loneReal;
    return null;
  }

  // ─── Teams web SDK probe (CSRC → participant id) ────────────────────────
  let activeCallCache = null;
  function getActiveCall() {
    if (activeCallCache) return activeCallCache;
    try {
      const dbg = window.callingDebug && window.callingDebug.observableCall;
      if (dbg) { activeCallCache = dbg; return activeCallCache; }
    } catch (_) {}
    try {
      const ref = window.msteamscalling && window.msteamscalling.deref && window.msteamscalling.deref();
      const svc = ref && ref.callingService;
      if (svc && typeof svc.getActiveCall === 'function') {
        const call = svc.getActiveCall();
        if (call) { activeCallCache = call; return activeCallCache; }
      }
    } catch (_) {}
    return null;
  }

  function probeSdkHealth() {
    const call = getActiveCall();
    if (!call) return { ok: false, reason: 'no_active_call' };
    if (!call.participants) return { ok: false, reason: 'no_participants' };
    return { ok: true };
  }

  function refreshParticipantNames() {
    const call = getActiveCall();
    if (!call || !call.participants) return;
    try {
      call.participants.forEach(function (p) {
        if (p && p.id && p.displayName) participantNames[p.id] = p.displayName;
      });
    } catch (_) {}
  }

  function pidsForCsrcs(csrcs) {
    const call = getActiveCall();
    if (!call || !call.participants) return [];
    const seen = new Set();
    try {
      call.participants.forEach(function (p) {
        if (!p || !p.id) return;
        for (let i = 0; i < csrcs.length; i++) {
          try {
            if (typeof p.hasAudioSource === 'function' && p.hasAudioSource(csrcs[i].source)) {
              seen.add(p.id);
              if (p.displayName) participantNames[p.id] = p.displayName;
              break;
            }
          } catch (_) {}
        }
      });
    } catch (_) {}
    return Array.from(seen);
  }

  // ─── Receiver registry + CSRC poll ──────────────────────────────────────
  const receivers = new Set();
  const seenReceivers = new WeakSet();
  function addReceiver(receiver) {
    if (!receiver || seenReceivers.has(receiver)) return;
    seenReceivers.add(receiver);
    receivers.add(receiver);
    log('receiver added', receiver.track && receiver.track.id);
  }

  let pollTimer = null;
  let pollTickCount = 0;
  let pollSdkUnavailableLogged = false;
  function startPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(function () {
      pollTickCount++;
      const health = probeSdkHealth();
      if (!health.ok) {
        if (!pollSdkUnavailableLogged) {
          pollSdkUnavailableLogged = true;
          warn('Teams SDK unavailable for CSRC mapping', health.reason);
          if (typeof window.__teamsFloorOwnerOnHealth === 'function') {
            try { window.__teamsFloorOwnerOnHealth({ ok: false, reason: health.reason, ts_ms: Date.now() }); } catch (_) {}
          }
        }
        return;
      }
      if (pollSdkUnavailableLogged) {
        pollSdkUnavailableLogged = false;
        if (typeof window.__teamsFloorOwnerOnHealth === 'function') {
          try { window.__teamsFloorOwnerOnHealth({ ok: true, ts_ms: Date.now() }); } catch (_) {}
        }
      }
      refreshParticipantNames();

      const now = Date.now();
      const recentCutoff = now - 50;
      const speakingPids = new Set();
      for (const r of receivers) {
        let sources = null;
        try { sources = r.getContributingSources ? r.getContributingSources() : null; } catch (_) { sources = null; }
        if (!sources || sources.length === 0) continue;
        const recent = [];
        for (let i = 0; i < sources.length; i++) {
          if (sources[i].timestamp >= recentCutoff) recent.push(sources[i]);
        }
        if (recent.length === 0) continue;
        const pids = pidsForCsrcs(recent);
        for (let i = 0; i < pids.length; i++) speakingPids.add(pids[i]);
      }
      recordCsrcEvent(now, speakingPids);
    }, POLL_MS);
  }

  // ─── RTCPeerConnection patch ────────────────────────────────────────────
  const NativePC = window.RTCPeerConnection;
  if (!NativePC) { warn('no RTCPeerConnection; aborting'); return; }
  function PatchedPC() {
    const pc = new NativePC(...arguments);
    pc.addEventListener('track', function (event) {
      try {
        if (event.track && event.track.kind === 'audio') {
          if (event.receiver) addReceiver(event.receiver);
          handleAudioTrack(event);
        }
      } catch (e) { warn('track handler failed', e && e.message); }
    });
    return pc;
  }
  PatchedPC.prototype = NativePC.prototype;
  Object.setPrototypeOf(PatchedPC, NativePC);
  window.RTCPeerConnection = PatchedPC;

  startPolling();

  // ─── Audio capture + queue + drain ──────────────────────────────────────
  const seenAudioTracks = new WeakSet();
  const queue = [];
  let queueDrainTimer = null;
  let lastStatsLog = 0;
  let stats = { framesIn: 0, framesEmitted: 0, framesUnknown: 0 };

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

  function ensureQueueDrain() {
    if (queueDrainTimer) return;
    queueDrainTimer = setInterval(function () {
      const now = Date.now();
      while (queue.length > 0 && now - queue[0].ts_ms >= QUEUE_LAG_MS) {
        const item = queue.shift();
        const pid = routeWithFloorOwner(item.ts_ms);
        if (!pid) { stats.framesUnknown++; continue; }
        const participantName = participantNames[pid] || null;
        stats.framesEmitted++;
        if (typeof window.__teamsFloorOwnerOnAttributedFrame === 'function') {
          try {
            window.__teamsFloorOwnerOnAttributedFrame({
              pcm_b64: item.pcm_b64,
              ts_ms: item.ts_ms,
              participant_id: pid,
              participant_name: participantName,
              sample_rate: TARGET_SR,
            });
            lastFrameOwner = pid;
          } catch (e) { warn('bridge call failed', e && e.message); }
        }
      }
      if (now - lastStatsLog >= STATS_LOG_MS) {
        lastStatsLog = now;
        log('stats', JSON.stringify({
          poll_ticks: pollTickCount,
          frames_in: stats.framesIn,
          frames_emitted: stats.framesEmitted,
          frames_unknown: stats.framesUnknown,
          floor_owner: floorOwner,
          last_frame_owner: lastFrameOwner,
          provisional_owner: provisionalOwner,
          qualified_speakers: Array.from(qualifiedSpeakers),
          csrc_events: csrcEvents.length,
          queue_depth: queue.length,
        }));
      }
    }, FRAME_EMIT_MS);
  }

  async function handleAudioTrack(event) {
    if (!event.track || seenAudioTracks.has(event.track)) return;
    seenAudioTracks.add(event.track);
    const trackId = event.track.id;
    log('intercepting audio track', trackId);
    if (typeof MediaStreamTrackProcessor !== 'function') {
      warn('MediaStreamTrackProcessor unavailable; falling back disabled');
      return;
    }
    let processor;
    try { processor = new MediaStreamTrackProcessor({ track: event.track }); }
    catch (e) { warn('MediaStreamTrackProcessor ctor failed', e && e.message); return; }

    const samplesPerFrame = Math.round(TARGET_SR * FRAME_EMIT_MS / 1000);
    let accum = new Float32Array(0);

    const reader = processor.readable.getReader();
    ensureQueueDrain();
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
            const pcm16 = floatToPcm16(chunk);
            const b64 = pcm16ToBase64(pcm16);
            stats.framesIn++;
            queue.push({ ts_ms: Date.now(), pcm_b64: b64 });
            const carry = new Float32Array(rest.length);
            carry.set(rest, 0);
            accum = carry;
          }
        } finally {
          try { frame.close(); } catch (_) {}
        }
      }
    } catch (e) {
      warn('audio reader loop failed', e && e.message);
    } finally {
      try { reader.releaseLock(); } catch (_) {}
      log('audio reader closed', trackId);
    }
  }

  // ─── Snapshot for diagnostics ───────────────────────────────────────────
  window.__teamsFloorOwnerSnapshot = function () {
    return {
      poll_ticks: pollTickCount,
      participant_names: Object.assign({}, participantNames),
      receivers: receivers.size,
      stats: Object.assign({}, stats),
      queue_depth: queue.length,
      csrc_events: csrcEvents.length,
      floor_owner: floorOwner,
      solo_speaker: soloSpeaker,
      last_frame_owner: lastFrameOwner,
      provisional_owner: provisionalOwner,
      provisional_start_ms: provisionalStartMs,
      qualified_speakers: Array.from(qualifiedSpeakers),
      noise_name_pattern: noiseNamePatternSource,
    };
  };

  log('installed; awaiting audio tracks', JSON.stringify({
    queue_lag_ms: QUEUE_LAG_MS,
    min_solo_ms: FLOOR_OWNER_MIN_SOLO_MS,
    pre_roll_ms: PRE_ROLL_MS,
    noise_name_pattern: noiseNamePatternSource,
  }));
})();
`;

module.exports = { SCRIPT };
