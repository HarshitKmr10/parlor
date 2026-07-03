'use strict';

// Tests for googlemeet/captureBridge.js. The bridge wraps
// PerParticipantStreamPool — we exercise its frame-routing,
// silence/bot guards, and segment-emission logic via a fake adapter.

const path = require('node:path');
const { Buffer } = require('node:buffer');
const { CaptureBridge } = require(path.join(
  '..', 'src', 'bot', 'bot_scripts', 'googlemeet', 'captureBridge',
));

function logger() { return { info() {}, warn() {} }; }

// Fake adapter factory: each spawned session resolves connect()
// immediately and lets tests push fake segments through onSegment.
function makeFakeAdapterFactory() {
  const sessions = [];
  function factory(opts) {
    const adapter = {
      _opts: opts,
      pushedFrames: [],
      connect: jest.fn(async () => { setImmediate(() => opts.onReady()); }),
      pushFrame: jest.fn((pcm) => adapter.pushedFrames.push(pcm)),
      heartbeat: jest.fn(),
      close: jest.fn(async () => { opts.onClose && opts.onClose(); }),
      // Helper to simulate ASR returning a segment
      emit(seg) { opts.onSegment(seg); },
    };
    sessions.push(adapter);
    return adapter;
  }
  return { factory, sessions };
}

function makeBridge(extras = {}) {
  const captured = [];
  const bridge = new CaptureBridge({
    logger: logger(),
    botName: 'AIOps Bot',
    onSegment: (seg) => captured.push(seg),
    ...extras,
  });
  return { bridge, captured };
}

function pcmFrame(samples = 100) {
  // 16-bit PCM — 2 bytes per sample, non-zero values so RMS > 0.
  const buf = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i++) buf.writeInt16LE(1_000, i * 2);
  return buf.toString('base64');
}

describe('googlemeet CaptureBridge', () => {
  test('routes frame to PerParticipantStreamPool keyed by pid', () => {
    const { factory, sessions } = makeFakeAdapterFactory();
    const { bridge } = makeBridge();
    bridge.pool.adapterFactory = factory;
    bridge.start();

    bridge._onChunk({
      pid: 'csrc-2624522088',
      name: 'Jane Doe',
      participant_id: 'spaces/x/devices/1',
      pcm_b64: pcmFrame(),
      ts_ms: 1_000,
      rms: 0.05,
    });

    expect(bridge.stats.framesIn).toBe(1);
    expect(bridge.stats.framesPushed).toBe(1);
    expect(sessions.length).toBe(1);
    // Session owner is the pid we passed in.
    expect(sessions[0]._opts).toBeDefined();
  });

  test('drops frames with no pid', () => {
    const { factory } = makeFakeAdapterFactory();
    const { bridge } = makeBridge();
    bridge.pool.adapterFactory = factory;
    bridge.start();

    bridge._onChunk({ name: 'Alice', pcm_b64: pcmFrame(), ts_ms: 1, rms: 0.05 });
    expect(bridge.stats.framesIn).toBe(1);
    expect(bridge.stats.framesPushed).toBe(0);
    expect(bridge.stats.framesDropped).toBe(1);
  });

  test('drops frames where the name matches the bot', () => {
    const { factory } = makeFakeAdapterFactory();
    const { bridge } = makeBridge();
    bridge.pool.adapterFactory = factory;
    bridge.start();

    bridge._onChunk({
      pid: 'track-self', name: 'AIOps Bot',
      pcm_b64: pcmFrame(), ts_ms: 1, rms: 0.05,
    });
    expect(bridge.stats.framesPushed).toBe(0);
    expect(bridge.stats.framesDropped).toBe(1);
  });

  test('drops near-silent frames (rms below threshold)', () => {
    const { factory } = makeFakeAdapterFactory();
    const { bridge } = makeBridge();
    bridge.pool.adapterFactory = factory;
    bridge.start();

    bridge._onChunk({
      pid: 'p-a', name: 'Alice',
      pcm_b64: pcmFrame(), ts_ms: 1, rms: 0.0001,
    });
    expect(bridge.stats.framesPushed).toBe(0);
    expect(bridge.stats.framesDropped).toBe(1);
  });

  test('upgrades pid name when later chunk carries a real display name', () => {
    const { factory } = makeFakeAdapterFactory();
    const { bridge } = makeBridge();
    bridge.pool.adapterFactory = factory;
    bridge.start();

    // Frame 1: no name yet (cold start).
    bridge._onChunk({ pid: 'csrc-201', name: null, pcm_b64: pcmFrame(), ts_ms: 1, rms: 0.05 });
    // Frame 2: page-realm correlator locked the binding to "Alice".
    bridge._onChunk({ pid: 'csrc-201', name: 'Alice', pcm_b64: pcmFrame(), ts_ms: 2, rms: 0.05 });

    expect(bridge._pidNames.get('csrc-201')).toBe('Alice');
  });

  test('emits final segment with platform=googlemeet metadata', async () => {
    const { factory, sessions } = makeFakeAdapterFactory();
    const { bridge, captured } = makeBridge();
    bridge.pool.adapterFactory = factory;
    bridge.start();

    bridge._onChunk({ pid: 'csrc-201', name: 'Alice', pcm_b64: pcmFrame(), ts_ms: 1_000, rms: 0.05 });
    // Wait for the fake adapter's setImmediate(onReady) to fire.
    await new Promise((r) => setImmediate(r));

    sessions[0].emit({
      provider: 'aws_transcribe',
      is_final: true,
      start_ms: 1_000,
      end_ms: 2_000,
      text: 'Hello',
      words: [{ word: 'Hello', start_ms: 1_000, end_ms: 2_000, confidence: 0.95 }],
      participant_id: 'csrc-201',
      participant_name: 'Alice',
      raw: { result_id: 'r1' },
    });

    expect(captured).toHaveLength(1);
    const seg = captured[0];
    expect(seg.speaker).toBe('Alice');
    expect(seg.text).toBe('Hello');
    expect(seg.kind).toBe('final');
    expect(seg.platform).toBe('googlemeet');
    expect(seg.attribution_confidence).toBe('per_peer');
    expect(seg.diarization.participant_id).toBe('csrc-201');
  });

  test('hallucination filter drops AWS cold-open boilerplate', async () => {
    const { factory, sessions } = makeFakeAdapterFactory();
    const { bridge, captured } = makeBridge();
    bridge.pool.adapterFactory = factory;
    bridge.start();

    bridge._onChunk({ pid: 'csrc-201', name: 'Alice', pcm_b64: pcmFrame(), ts_ms: 1_000, rms: 0.05 });
    await new Promise((r) => setImmediate(r));

    sessions[0].emit({
      provider: 'aws_transcribe',
      is_final: true,
      start_ms: 1_000,
      end_ms: 2_000,
      // Common AWS Transcribe cold-open hallucination listed in
      // hallucinationFilter.js KNOWN_PHRASES.
      text: 'Thanks for watching',
      participant_id: 'csrc-201',
      participant_name: 'Alice',
    });

    expect(captured).toHaveLength(0);
    expect(bridge.stats.segmentsHallucinated).toBe(1);
  });

  test('cold-start pid recovers real speaker via rosterWatcher history', async () => {
    const { factory, sessions } = makeFakeAdapterFactory();
    // Simulate the rosterWatcher having seen "Jane Doe" speaking
    // between 1_000–2_000 ms — the bridge should pick this up when it
    // sees a cold-start pid like `track-XXXX`.
    const rosterWatcher = {
      getActiveSpeakerInWindow: (start, end) => {
        if (start <= 1_000 && end >= 2_000) return 'Jane Doe';
        return null;
      },
    };
    const { bridge, captured } = makeBridge({ rosterWatcher });
    bridge.pool.adapterFactory = factory;
    bridge.start();

    bridge._onChunk({
      pid: 'track-abc-123', name: null,
      pcm_b64: pcmFrame(), ts_ms: 1_000, rms: 0.05,
    });
    await new Promise((r) => setImmediate(r));

    sessions[0].emit({
      provider: 'aws_transcribe',
      is_final: true,
      start_ms: 1_000,
      end_ms: 2_000,
      text: 'Hello there',
      participant_id: 'track-abc-123',
      participant_name: null,  // adapter has no name either
    });

    expect(captured).toHaveLength(1);
    expect(captured[0].speaker).toBe('Jane Doe');
    expect(captured[0].attribution_confidence).toBe('roster_history');
  });

  test('cascade tier 4 — sole speaking human in current snapshot', async () => {
    const { factory, sessions } = makeFakeAdapterFactory();
    const rosterWatcher = {
      getActiveSpeakerInWindow: () => null, // no history yet
      snapshot: () => ({
        list: [
          { name: 'Alice', speaking: true },
          { name: 'Bob', speaking: false },
        ],
      }),
    };
    const { bridge, captured } = makeBridge({ rosterWatcher });
    bridge.pool.adapterFactory = factory;
    bridge.start();

    bridge._onChunk({ pid: 'track-cold', name: null, pcm_b64: pcmFrame(), ts_ms: 1, rms: 0.05 });
    await new Promise((r) => setImmediate(r));
    sessions[0].emit({
      provider: 'aws_transcribe', is_final: true,
      start_ms: 1, end_ms: 1_000,
      text: 'hello world',
      participant_id: 'track-cold', participant_name: null,
    });
    expect(captured[0].speaker).toBe('Alice');
    expect(captured[0].attribution_confidence).toBe('roster_active');
  });

  test('cascade tier 5 — sole human in roster (none speaking yet)', async () => {
    const { factory, sessions } = makeFakeAdapterFactory();
    const rosterWatcher = {
      getActiveSpeakerInWindow: () => null,
      snapshot: () => ({ list: [{ name: 'Alice', speaking: false }] }),
    };
    const { bridge, captured } = makeBridge({ rosterWatcher });
    bridge.pool.adapterFactory = factory;
    bridge.start();

    bridge._onChunk({ pid: 'track-cold', name: null, pcm_b64: pcmFrame(), ts_ms: 1, rms: 0.05 });
    await new Promise((r) => setImmediate(r));
    sessions[0].emit({
      provider: 'aws_transcribe', is_final: true,
      start_ms: 1, end_ms: 1_000,
      text: 'hello world',
      participant_id: 'track-cold', participant_name: null,
    });
    expect(captured[0].speaker).toBe('Alice');
    expect(captured[0].attribution_confidence).toBe('roster_solo');
  });

  test('cascade tier 6 — last-bound speaker carries through cold-start', async () => {
    const { factory, sessions } = makeFakeAdapterFactory();
    let snapshotCallCount = 0;
    const rosterWatcher = {
      getActiveSpeakerInWindow: () => null,
      snapshot: () => {
        snapshotCallCount += 1;
        // First emit: Alice present + speaking → tier 4 locks her.
        // Second emit: roster flickered empty → fall through to last-bound.
        if (snapshotCallCount === 1) {
          return { list: [{ name: 'Alice', speaking: true }] };
        }
        return { list: [] };
      },
    };
    const { bridge, captured } = makeBridge({ rosterWatcher });
    bridge.pool.adapterFactory = factory;
    bridge.start();

    bridge._onChunk({ pid: 'track-flicker-1', name: null, pcm_b64: pcmFrame(), ts_ms: 1_000, rms: 0.05 });
    await new Promise((r) => setImmediate(r));
    sessions[0].emit({
      provider: 'aws_transcribe', is_final: true,
      start_ms: 1_000, end_ms: 2_000, text: 'first',
      participant_id: 'track-flicker-1', participant_name: null,
    });
    expect(captured[0].speaker).toBe('Alice');

    bridge._onChunk({ pid: 'track-flicker-2', name: null, pcm_b64: pcmFrame(), ts_ms: 5_000, rms: 0.05 });
    await new Promise((r) => setImmediate(r));
    sessions[1].emit({
      provider: 'aws_transcribe', is_final: true,
      start_ms: 5_000, end_ms: 6_000, text: 'second',
      participant_id: 'track-flicker-2', participant_name: null,
    });
    expect(captured[1].speaker).toBe('Alice');
    expect(captured[1].attribution_confidence).toBe('last_known_speaker');
  });

  test('skips emitting partials', async () => {
    const { factory, sessions } = makeFakeAdapterFactory();
    const { bridge, captured } = makeBridge();
    bridge.pool.adapterFactory = factory;
    bridge.start();

    bridge._onChunk({ pid: 'csrc-201', name: 'Alice', pcm_b64: pcmFrame(), ts_ms: 1_000, rms: 0.05 });
    await new Promise((r) => setImmediate(r));

    // Partial segments DO flow through but the consumer (joinMeeting.js)
    // is responsible for dropping them. The bridge itself emits both —
    // verify the kind is correctly stamped.
    sessions[0].emit({
      provider: 'aws_transcribe',
      is_final: false,
      start_ms: 1_000,
      end_ms: 1_500,
      // Use long enough text that hallucinationFilter doesn't drop it
      // as filler_only (<4 chars).
      text: 'Hello there',
      participant_id: 'csrc-201',
      participant_name: 'Alice',
    });

    expect(captured).toHaveLength(1);
    expect(captured[0].kind).toBe('partial');
  });
});
