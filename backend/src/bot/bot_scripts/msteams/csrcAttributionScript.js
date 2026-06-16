'use strict';

// Page-realm script for the `webrtc_csrc` attribution mode.
//
// Three concerns live here:
//
//   1. Hook RTCPeerConnection so every remote audio RTCRtpReceiver is known.
//   2. Poll receiver.getContributingSources() every 100 ms; resolve the
//      CSRC numeric IDs to Teams participant IDs via the live Teams web
//      SDK at window.msteamscalling.callingService.getActiveCall(); run a
//      5-of-5 debounce per participant; record speech-interval start/end.
//   3. Tap one MediaStreamTrackProcessor onto the (mixed) remote audio
//      track. For every PCM frame, queue it for ACTIVE_SPEAKER_LATENCY_MS
//      (2 000 ms by default) so the attribution data has time to settle,
//      then attribute the frame to whichever participant was speaking at
//      its arrival timestamp and ship it to the Node side via
//      window.__teamsBridgeOnAttributedFrame.
//
// On overlap (multiple speakers active at the same timestamp) the earliest
// speech-interval start wins. On zero attribution the frame is COUNTED in
// stats.framesUnknown and dropped — it never crosses the page→Node bridge
// and never reaches AWS Transcribe. The counter remains visible in the
// periodic [teams.csrc] stats log so you can observe how many frames the
// CSRC mapping fails to attribute.
//
// Returned as a string so it can be passed verbatim to page.addInitScript.

const SCRIPT = `
(() => {
  if (window.__teamsCsrcAttributionInstalled) return;
  window.__teamsCsrcAttributionInstalled = true;

  const TAG = '[teams.csrc]';
  const TARGET_SR = 16_000;             // PCM rate handed to Node
  const POLL_MS = 100;                  // CSRC poll cadence
  const ACTIVE_SPEAKER_LATENCY_MS = 2_000;  // attribution lookahead window
  const STATE_MACHINE_WINDOW = 5;       // 5-of-5 debounce
  const STATE_MACHINE_THRESHOLD = 3;    // ≥3 of last 5 → SPEAKING
  const FRAME_EMIT_MS = 100;            // node-bound frame cadence after attribution
  const STATS_LOG_MS = 10_000;

  function log() {
    try { console.log.apply(console, [TAG].concat(Array.from(arguments))); } catch (_) {}
  }
  function warn() {
    try { console.warn.apply(console, [TAG].concat(Array.from(arguments))); } catch (_) {}
  }

  // ─── Speech-interval store (per-participant) ────────────────────────────
  // Ordered list of {type:'start'|'end', ts_ms} per participant.
  // attributionAt() walks the list to determine "who was speaking at ts"
  // with earliest-start tiebreak for overlap.
  const speechIntervals = Object.create(null);  // pid -> [{type, ts_ms}, ...]
  const participantNames = Object.create(null); // pid -> displayName

  function addSpeechStart(ts_ms, pid) {
    if (!speechIntervals[pid]) speechIntervals[pid] = [];
    speechIntervals[pid].push({ type: 'start', ts_ms: ts_ms });
  }
  function addSpeechEnd(ts_ms, pid) {
    if (!speechIntervals[pid]) speechIntervals[pid] = [];
    speechIntervals[pid].push({ type: 'end', ts_ms: ts_ms });
  }

  function attributionAt(ts_ms) {
    const candidates = [];
    for (const pid in speechIntervals) {
      const intervals = speechIntervals[pid];
      let speaking = false;
      let lastStart = null;
      for (let i = 0; i < intervals.length; i++) {
        const it = intervals[i];
        if (it.ts_ms > ts_ms) break;
        if (it.type === 'start') { speaking = true; lastStart = it.ts_ms; }
        else if (it.type === 'end') { speaking = false; }
      }
      if (speaking) candidates.push({ pid: pid, lastStart: lastStart });
    }
    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0].pid;
    // Earliest-start tiebreaker: the speaker who started first wins. This
    // is intentional — handing the same frame to two ASR sessions causes
    // duplicate transcripts that downstream can't sanely dedupe by
    // chunk_id (we explicitly disabled dedup in this mode).
    let best = candidates[0];
    for (let i = 1; i < candidates.length; i++) {
      if (candidates[i].lastStart < best.lastStart) best = candidates[i];
    }
    return best.pid;
  }

  // ─── 5-of-5 debounce per participant ────────────────────────────────────
  // Receives one sample per 100 ms poll: {pid, isSpeaking}. Transitions
  // NOT_SPEAKING → SPEAKING when ≥3 of last 5 are speaking. State
  // transitions emit speech-interval start/end events.
  const stateMachines = Object.create(null);  // pid -> {state, samples:[]}

  function pushSample(pid, isSpeaking, ts_ms) {
    let sm = stateMachines[pid];
    if (!sm) { sm = { state: 'NOT_SPEAKING', samples: [] }; stateMachines[pid] = sm; }
    sm.samples.push({ isSpeaking: isSpeaking, ts_ms: ts_ms });
    if (sm.samples.length > STATE_MACHINE_WINDOW * 2) sm.samples.shift();
    const last5 = sm.samples.slice(-STATE_MACHINE_WINDOW);
    if (last5.length < STATE_MACHINE_WINDOW) return;
    let speakingCount = 0;
    for (let i = 0; i < last5.length; i++) if (last5[i].isSpeaking) speakingCount++;
    const newState = speakingCount >= STATE_MACHINE_THRESHOLD ? 'SPEAKING' : 'NOT_SPEAKING';
    const firstTs = last5[0].ts_ms;
    if (sm.state === 'NOT_SPEAKING' && newState === 'SPEAKING') {
      sm.state = 'SPEAKING';
      addSpeechStart(firstTs, pid);
    } else if (sm.state === 'SPEAKING' && newState === 'NOT_SPEAKING') {
      sm.state = 'NOT_SPEAKING';
      addSpeechEnd(firstTs - 100, pid);
    }
  }

  // ─── Teams web SDK probe (CSRC → participant-id) ────────────────────────
  // The bot runs Teams' web client; the live call object is reachable
  // through window.msteamscalling. Two probe paths are used because the
  // Teams build varies: window.callingDebug.observableCall (older builds)
  // and window.msteamscalling.callingService.getActiveCall() (current).
  // Each participant has a .hasAudioSource(csrc) method that knows its
  // own RTP CSRC list.
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
        if (p && p.id && p.displayName) {
          participantNames[p.id] = p.displayName;
        }
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

  // ─── Receiver registry and CSRC poll ────────────────────────────────────
  const receivers = new Set();   // RTCRtpReceiver objects for kind=audio
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
          if (typeof window.__teamsCsrcOnHealth === 'function') {
            try { window.__teamsCsrcOnHealth({ ok: false, reason: health.reason, ts_ms: Date.now() }); } catch (_) {}
          }
        }
        return;
      }
      if (pollSdkUnavailableLogged) {
        pollSdkUnavailableLogged = false;
        if (typeof window.__teamsCsrcOnHealth === 'function') {
          try { window.__teamsCsrcOnHealth({ ok: true, ts_ms: Date.now() }); } catch (_) {}
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

      // Sample every known participant — those not in speakingPids get a
      // negative sample so the state machine can transition out.
      const knownPids = Object.keys(stateMachines);
      for (let i = 0; i < knownPids.length; i++) {
        pushSample(knownPids[i], speakingPids.has(knownPids[i]), now);
      }
      // Newly-speaking pids enter the state machine.
      speakingPids.forEach(function (pid) {
        if (!stateMachines[pid]) pushSample(pid, true, now);
      });
    }, POLL_MS);
  }

  // ─── RTCPeerConnection patch ────────────────────────────────────────────
  // peerStreamsScript may have run first and already wrapped RTCPeerConnection;
  // that's fine — we wrap whatever is at window.RTCPeerConnection now and add
  // an additional 'track' listener. Both layers' listeners fire.
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

  // ─── Audio interception + 2 s attribution queue ─────────────────────────
  // We process the FIRST audio track we see from any peer connection.
  // Teams' SFU mixes all remote participants into a single inbound audio
  // track; subsequent track events on the same peer connection are
  // typically duplicates we can ignore. seenAudioTracks dedupes.
  const seenAudioTracks = new WeakSet();
  const queue = [];   // {ts_ms, pcm_b64}
  let queueDrainTimer = null;
  let lastStatsLog = 0;
  let stats = { framesIn: 0, framesEmitted: 0, framesUnknown: 0, attributedKnown: 0 };

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
      while (queue.length > 0 && now - queue[0].ts_ms >= ACTIVE_SPEAKER_LATENCY_MS) {
        const item = queue.shift();
        const pid = attributionAt(item.ts_ms);
        if (!pid) {
          // No participant in SPEAKING state at item.ts_ms → drop the frame.
          // Counted for diagnostics; never emitted, never billed.
          stats.framesUnknown++;
          continue;
        }
        const participantName = participantNames[pid] || null;
        stats.attributedKnown++;
        stats.framesEmitted++;
        if (typeof window.__teamsBridgeOnAttributedFrame === 'function') {
          try {
            window.__teamsBridgeOnAttributedFrame({
              pcm_b64: item.pcm_b64,
              ts_ms: item.ts_ms,
              participant_id: pid,
              participant_name: participantName,
              sample_rate: TARGET_SR,
            });
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
          frames_known: stats.attributedKnown,
          tracked_participants: Object.keys(stateMachines).length,
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

    // Accumulator: build TARGET_SR mono PCM windows of FRAME_EMIT_MS each.
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
          // Append to accumulator
          if (accum.length === 0) {
            accum = resampled;
          } else {
            const merged = new Float32Array(accum.length + resampled.length);
            merged.set(accum, 0);
            merged.set(resampled, accum.length);
            accum = merged;
          }
          // Drain N samples per emission
          while (accum.length >= samplesPerFrame) {
            const chunk = accum.subarray(0, samplesPerFrame);
            const rest = accum.subarray(samplesPerFrame);
            const pcm16 = floatToPcm16(chunk);
            const b64 = pcm16ToBase64(pcm16);
            stats.framesIn++;
            queue.push({ ts_ms: Date.now(), pcm_b64: b64 });
            // Copy rest into a fresh Float32Array so we don't keep the
            // backing buffer of the original frame alive forever.
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
  window.__teamsCsrcSnapshot = function () {
    const known = Object.keys(stateMachines);
    return {
      poll_ticks: pollTickCount,
      tracked_participants: known,
      participant_names: Object.assign({}, participantNames),
      receivers: receivers.size,
      stats: Object.assign({}, stats),
      queue_depth: queue.length,
    };
  };

  log('installed; awaiting audio tracks');
})();
`;

module.exports = { SCRIPT };
