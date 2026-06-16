'use strict';

// In-page recorder. Per-speaker captures: a ScriptProcessorNode attached to
// every <audio> element our peer-streams hook produced. Yields raw PCM
// Float32 frames per audioprocess callback, which we buffer into N-second
// windows and ship to the Node side as ArrayBuffer (binary, no base64).
//
// Why ScriptProcessorNode instead of AudioWorkletNode: AudioWorklet requires
// loading a module via URL. Blob: URLs are blocked by Teams' page CSP
// (`worklet registration failed: Unable to load a worklet's module`) and
// data: URLs need a same-origin policy that we don't get inside teams.live.
// ScriptProcessorNode is deprecated but loads no external module, runs on
// the main thread with negligible overhead for our 16 kHz mono use case, and
// still works in current Chromium. Vexa uses the same fallback.

const SCRIPT = `
(() => {
  if (window.__teamsRecorderInstalled) return;
  window.__teamsRecorderInstalled = true;

  const TAG = '[teams.recorder]';
  const SR = 16_000;            // target sample rate after resampling
  const HOP_MS = 100;           // worklet hop
  const WINDOW_MS = parseInt('__WINDOW_MS__', 10) || 5_000;
  const BYTES_PER_SAMPLE = 4;   // Float32

  try { console.log(TAG, 'installed', { window_ms: WINDOW_MS, target_sr: SR }); } catch (_) {}

  const captures = new Map();   // trackId -> { ctx, src, processor, accum, ts0, peerId }

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

  function wrapWav(pcm16, sampleRate) {
    const dataSize = pcm16.byteLength;
    const buf = new ArrayBuffer(44 + dataSize);
    const v = new DataView(buf);
    let p = 0;
    function w8(c) { v.setUint8(p++, c); }
    function w32(n) { v.setUint32(p, n, true); p += 4; }
    function w16(n) { v.setUint16(p, n, true); p += 2; }
    'RIFF'.split('').forEach(c => w8(c.charCodeAt(0)));
    w32(36 + dataSize);
    'WAVE'.split('').forEach(c => w8(c.charCodeAt(0)));
    'fmt '.split('').forEach(c => w8(c.charCodeAt(0)));
    w32(16); w16(1); w16(1); w32(sampleRate); w32(sampleRate * 2); w16(2); w16(16);
    'data'.split('').forEach(c => w8(c.charCodeAt(0)));
    w32(dataSize);
    new Uint8Array(buf, 44).set(new Uint8Array(pcm16.buffer));
    return buf;
  }

  async function attachCapture(audioEl) {
    const trackId = audioEl.getAttribute('data-bridge-track');
    if (!trackId || captures.has(trackId)) return;
    if (!audioEl.srcObject) {
      try { console.log(TAG, 'attach skipped, no srcObject', trackId); } catch (_) {}
      return;
    }
    const peerId = audioEl.getAttribute('data-bridge-peer') || '0';
    try { console.log(TAG, 'attach begin', trackId, 'peer', peerId); } catch (_) {}

    let ctx;
    try {
      // Force the AudioContext to our target rate so we skip the resample
      // step and the PCM the worklet emits is already 16 kHz.
      const Ctor = window.AudioContext || window.webkitAudioContext;
      try { ctx = new Ctor({ sampleRate: SR }); }
      catch (_e) { ctx = new Ctor(); }
    } catch (err) {
      try { console.warn(TAG, 'attach failed (ctx)', trackId, err && err.message); } catch (_) {}
      return;
    }
    const src = ctx.createMediaStreamSource(audioEl.srcObject);
    // Power-of-two buffer between 256-16384. 4096 @ 44.1k ≈ 92 ms per
    // callback, low-enough latency, low-enough callback rate.
    const processor = ctx.createScriptProcessor(4096, 1, 1);
    src.connect(processor);
    // Processor must connect to dest for onaudioprocess to fire; mute via gain.
    const sink = ctx.createGain();
    sink.gain.value = 0;
    processor.connect(sink).connect(ctx.destination);

    const state = {
      ctx,
      src,
      processor,
      sink,
      peerId,
      ts0: Date.now(),
      accum: [],
      accumSamples: 0,
      sampleRate: ctx.sampleRate,
      framesSeen: 0,
      chunksDispatched: 0,
      bridgeMissingLogged: false,
    };
    captures.set(trackId, state);

    processor.onaudioprocess = (event) => {
      const ch0 = event.inputBuffer.getChannelData(0);
      // Float32Array views into the AudioBuffer become invalid after the
      // callback returns. Copy before buffering.
      const copy = new Float32Array(ch0.length);
      copy.set(ch0);
      state.accum.push(copy);
      state.accumSamples += copy.length;
      state.framesSeen += 1;
      if (state.framesSeen === 1) {
        try { console.log(TAG, 'first frame', trackId, 'len', copy.length); } catch (_) {}
      }
      const targetSamples = Math.round(state.sampleRate * (WINDOW_MS / 1000));
      if (state.accumSamples >= targetSamples) {
        const merged = new Float32Array(state.accumSamples);
        let o = 0;
        for (const part of state.accum) { merged.set(part, o); o += part.length; }
        state.accum = [];
        state.accumSamples = 0;
        const ts0 = state.ts0;
        state.ts0 = Date.now();

        // Compute RMS over the merged (pre-resample) Float32 chunk. This is
        // the loudness signal the Node side uses to decide which track is
        // the actual speaker when multiple tracks deliver chunks for the
        // same time window — Teams' mixed audio bleeds into every track,
        // so the loudest track is the only reliable signal of who's
        // actually talking.
        let sumSq = 0;
        for (let i = 0; i < merged.length; i++) sumSq += merged[i] * merged[i];
        const rms = merged.length > 0 ? Math.sqrt(sumSq / merged.length) : 0;

        const downsampled = resampleFloat32(merged, state.sampleRate, SR);
        const pcm16 = floatToPcm16(downsampled);
        const wav = wrapWav(pcm16, SR);
        // Playwright's exposeBinding does NOT preserve ArrayBuffer / TypedArray
        // across the page→Node boundary; it serialises as a plain Object with
        // numeric keys, which Buffer.from() rejects. Encode to base64 (a string)
        // which round-trips reliably and decode on the Node side.
        const u8 = new Uint8Array(wav);
        let bin = '';
        const CHUNK = 0x8000; // avoid stack overflow on very large windows
        for (let i = 0; i < u8.length; i += CHUNK) {
          bin += String.fromCharCode.apply(null, u8.subarray(i, i + CHUNK));
        }
        const wavB64 = btoa(bin);
        // Capture CSRC source list for THIS chunk's time window. The
        // peer-streams hook saved the audio receiver at track-attach
        // time; we poll its getContributingSources() right now to get
        // the per-participant RTP source IDs that contributed to this
        // chunk's audio. The bridge correlates source → name across
        // chunks. Best-effort: if the receiver isn't available yet
        // (cold start), we ship an empty list and the bridge falls
        // back to roster-based attribution.
        let csrcSources = [];
        try {
          if (typeof window.__teamsBridgeGetCsrcs === 'function') {
            csrcSources = window.__teamsBridgeGetCsrcs(trackId) || [];
          }
        } catch (_) { /* ignore */ }

        if (typeof window.__teamsBridgeOnPcmChunk === 'function') {
          try {
            window.__teamsBridgeOnPcmChunk({
              trackId,
              peerId: state.peerId,
              ts_start_ms: ts0,
              ts_end_ms: Date.now(),
              sample_rate: SR,
              rms,
              wav_b64: wavB64,
              csrc_sources: csrcSources,
            });
            state.chunksDispatched += 1;
            if (state.chunksDispatched === 1) {
              try { console.log(TAG, 'first chunk dispatched', trackId, 'bytes', wav.byteLength); } catch (_) {}
            }
          } catch (e) { try { console.warn(TAG, 'pcm callback failed', e && e.message); } catch (_) {} }
        } else if (!state.bridgeMissingLogged) {
          state.bridgeMissingLogged = true;
          try { console.warn(TAG, 'bridge fn missing, dropping chunks', trackId); } catch (_) {}
        }
      }
    };
    try { console.log(TAG, 'capture started', trackId, 'peer', peerId, 'ctxSR', state.sampleRate); } catch (_) {}
  }

  function detach(trackId) {
    const s = captures.get(trackId);
    if (!s) return;
    captures.delete(trackId);
    try { s.processor.onaudioprocess = null; } catch (_) {}
    try { s.processor.disconnect(); } catch (_) {}
    try { s.src.disconnect(); } catch (_) {}
    try { s.ctx.close(); } catch (_) {}
  }

  // Sweep new audio elements; cheaper than MutationObserver for this volume.
  let lastSeenCount = -1;
  setInterval(() => {
    const elems = document.querySelectorAll('audio[data-bridge-track]');
    if (elems.length !== lastSeenCount) {
      try { console.log(TAG, 'sweep', { audio_elements: elems.length, captures: captures.size }); } catch (_) {}
      lastSeenCount = elems.length;
    }
    elems.forEach((el) => {
      attachCapture(el).catch(() => {});
    });
    captures.forEach((_state, id) => {
      if (!document.querySelector('audio[data-bridge-track="' + id + '"]')) detach(id);
    });
  }, 500);

  window.__teamsRecorderStop = () => {
    captures.forEach((_s, id) => detach(id));
  };

  // ─── Caption observer (Vexa-style) ──────────────────────────────────────
  // Teams renders live captions inside a known wrapper. The only stable
  // atoms across host vs guest views are:
  //   [data-tid="author"]              — speaker name
  //   [data-tid="closed-caption-text"] — caption text
  // We pair the LAST author+text — they appear in document order. Teams
  // updates the text in-place as ASR refines, so we deduplicate by a
  // (speaker, text) key and only forward growth (>3 chars) or new entries
  // (text length shrank → new caption).
  const CAP_TAG = '[teams.caption]';
  const MIN_TEXT_GROWTH = 3;
  let lastCaptionKey = '';
  let lastSpeaker = null;
  let lastFlushedTextLength = 0;
  let captionPollLogged = false;

  function processCaptions() {
    const wrapper = document.querySelector('[data-tid="closed-caption-renderer-wrapper"]');
    if (!wrapper) return;
    if (!captionPollLogged) {
      captionPollLogged = true;
      try { console.log(CAP_TAG, 'caption renderer wrapper present, observing'); } catch (_) {}
    }
    const authors = wrapper.querySelectorAll('[data-tid="author"]');
    const texts = wrapper.querySelectorAll('[data-tid="closed-caption-text"]');
    if (!authors.length || !texts.length) return;

    const lastAuthor = authors[authors.length - 1];
    const lastText = texts[texts.length - 1];
    const speaker = (lastAuthor.textContent || '').trim();
    const text = (lastText.textContent || '').trim();
    if (!speaker || !text) return;

    const key = speaker + '::' + text;
    if (key === lastCaptionKey) return;
    lastCaptionKey = key;

    const now = Date.now();
    const isNewSpeaker = speaker !== lastSpeaker;
    const growth = text.length - lastFlushedTextLength;
    const shouldEmit = isNewSpeaker || growth > MIN_TEXT_GROWTH || text.length < lastFlushedTextLength;
    if (!shouldEmit) return;

    if (isNewSpeaker) {
      try { console.log(CAP_TAG, 'speaker change', { from: lastSpeaker || '(none)', to: speaker }); } catch (_) {}
      lastFlushedTextLength = 0;
    }
    lastSpeaker = speaker;
    lastFlushedTextLength = text.length;

    if (typeof window.__teamsBridgeOnCaption === 'function') {
      try {
        window.__teamsBridgeOnCaption({ speaker, text, ts_ms: now });
      } catch (e) { try { console.warn(CAP_TAG, 'bridge call failed', e && e.message); } catch (_) {} }
    }
  }

  setInterval(processCaptions, 500);

})();
`;

// `mixedStream` and `mixedFrameMs` parameters are accepted but
// ignored — kept for backwards compatibility with the join.js call
// site, which still passes them. The mixed-stream → diarizer pipeline
// they fed was deleted in PR #3500.
function buildScript({ windowMs = 5_000 } = {}) {
  return SCRIPT.replace('__WINDOW_MS__', String(windowMs));
}

module.exports = { buildScript };
