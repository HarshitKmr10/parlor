'use strict';

// Cheap energy + zero-crossing-rate VAD. Runs on the Node side over a WAV
// PCM16 buffer. We use it to skip Whisper round-trips on near-silent windows,
// which is where most hallucinations originate. Not meant to replace WebRTC
// VAD — meant to be a 100 µs guard.

function pcm16Iter(buffer) {
  // Skip the 44-byte WAV header and iterate Int16 samples in one pass.
  const view = new DataView(buffer);
  const start = 44;
  const len = (buffer.byteLength - start) / 2;
  return { len, sample: (i) => view.getInt16(start + i * 2, true) };
}

function rms(buffer) {
  const it = pcm16Iter(buffer);
  if (it.len === 0) return 0;
  let sumSq = 0;
  for (let i = 0; i < it.len; i++) {
    const s = it.sample(i) / 0x8000;
    sumSq += s * s;
  }
  return Math.sqrt(sumSq / it.len);
}

function zcr(buffer) {
  const it = pcm16Iter(buffer);
  if (it.len < 2) return 0;
  let crosses = 0;
  let prev = it.sample(0);
  for (let i = 1; i < it.len; i++) {
    const cur = it.sample(i);
    if ((prev < 0 && cur >= 0) || (prev >= 0 && cur < 0)) crosses++;
    prev = cur;
  }
  return crosses / (it.len - 1);
}

const DEFAULT = Object.freeze({
  rmsThreshold: 0.01,   // ~ -40 dBFS
  zcrMin: 0.005,
  zcrMax: 0.45,
});

function isSpeech(buffer, opts = {}) {
  const cfg = { ...DEFAULT, ...opts };
  const energy = rms(buffer);
  if (energy < cfg.rmsThreshold) return { speech: false, reason: 'low_energy', energy, zcr: null };
  const z = zcr(buffer);
  if (z < cfg.zcrMin || z > cfg.zcrMax) {
    return { speech: false, reason: 'zcr_out_of_band', energy, zcr: z };
  }
  return { speech: true, reason: 'ok', energy, zcr: z };
}

module.exports = { isSpeech, rms, zcr, DEFAULT };
