'use strict';

// Tests for the captureBridge._onCaption ingestion path — the entry
// point that fires when the in-page captionsScraperScript pushes a
// caption update from Google Meet's DOM. Verifies attribution
// cascading, hallucination filtering, and segment shape (provider:
// 'gmeet_captions', kind: 'caption', platform: 'googlemeet').

const path = require('node:path');
const { CaptureBridge } = require(path.join(
  '..', 'src', 'bot', 'bot_scripts', 'googlemeet', 'captureBridge',
));

function logger() { return { info() {}, warn() {} }; }

function makeBridge(extras = {}) {
  const captured = [];
  const bridge = new CaptureBridge({
    logger: logger(),
    botName: 'AIOps Bot',
    onSegment: (seg) => captured.push(seg),
    // Captions mode never spawns the AWS pool, but constructor still
    // resolves an adapter factory — give it a stub so we don't load
    // SDKs in the test process.
    adapterFactory: () => ({
      connect: async () => {}, pushFrame: () => {}, heartbeat: () => {}, close: async () => {},
    }),
    ...extras,
  });
  return { bridge, captured };
}

describe('CaptureBridge._onCaption', () => {
  test('emits gmeet_captions segment with caption-author attribution', async () => {
    const { bridge, captured } = makeBridge();
    await bridge._onCaption({ speaker: 'Jane Doe', text: 'hello there', ts_ms: 1_000 });
    expect(captured).toHaveLength(1);
    const seg = captured[0];
    expect(seg.speaker).toBe('Jane Doe');
    expect(seg.text).toBe('hello there');
    expect(seg.kind).toBe('caption');
    expect(seg.provider).toBe('gmeet_captions');
    expect(seg.platform).toBe('googlemeet');
    expect(seg.attribution_confidence).toBe('caption_author');
  });

  test('drops caption hallucinations (Thanks for watching, etc.)', async () => {
    const { bridge, captured } = makeBridge();
    await bridge._onCaption({ speaker: 'Jane', text: 'Thanks for watching', ts_ms: 1_000 });
    expect(captured).toHaveLength(0);
    expect(bridge.stats.captionHallucinated).toBe(1);
  });

  test('drops captions stamped with the bot name', async () => {
    const { bridge, captured } = makeBridge();
    await bridge._onCaption({ speaker: 'AIOps Bot', text: 'should be ignored', ts_ms: 1_000 });
    expect(captured).toHaveLength(0);
  });

  test('falls back to rosterWatcher.getActiveSpeakerInWindow when speaker missing', async () => {
    const rosterWatcher = {
      getActiveSpeakerInWindow: (start, end) => (
        start === -3_000 && end === 1_000 ? 'Jane Doe' : null
      ),
      snapshot: () => ({ list: [] }),
    };
    const { bridge, captured } = makeBridge({ rosterWatcher });
    await bridge._onCaption({ speaker: null, text: 'hello there', ts_ms: 1_000 });
    expect(captured[0].speaker).toBe('Jane Doe');
    expect(captured[0].attribution_confidence).toBe('roster_history');
  });

  test('falls back to lone speaking human in current snapshot', async () => {
    const rosterWatcher = {
      getActiveSpeakerInWindow: () => null,
      snapshot: () => ({
        list: [
          { name: 'Alice', speaking: true },
          { name: 'Bob', speaking: false },
        ],
      }),
    };
    const { bridge, captured } = makeBridge({ rosterWatcher });
    await bridge._onCaption({ speaker: null, text: 'hello there', ts_ms: 1_000 });
    expect(captured[0].speaker).toBe('Alice');
    expect(captured[0].attribution_confidence).toBe('roster_active');
  });

  test('falls back to sole human in roster when nobody is currently flagged speaking', async () => {
    const rosterWatcher = {
      getActiveSpeakerInWindow: () => null,
      snapshot: () => ({ list: [{ name: 'Alice', speaking: false }] }),
    };
    const { bridge, captured } = makeBridge({ rosterWatcher });
    await bridge._onCaption({ speaker: null, text: 'hello there', ts_ms: 1_000 });
    expect(captured[0].speaker).toBe('Alice');
    expect(captured[0].attribution_confidence).toBe('roster_solo');
  });

  test('falls through to last-bound speaker when roster is empty', async () => {
    const rosterWatcher = {
      getActiveSpeakerInWindow: () => null,
      snapshot: () => ({ list: [] }),
    };
    const { bridge, captured } = makeBridge({ rosterWatcher });
    // Prime the bridge by emitting a caption with a known speaker.
    await bridge._onCaption({ speaker: 'Alice', text: 'priming text', ts_ms: 500 });
    // Subsequent caption with no speaker + empty roster should reuse Alice.
    await bridge._onCaption({ speaker: null, text: 'follow-up text', ts_ms: 1_000 });
    expect(captured[1].speaker).toBe('Alice');
    expect(captured[1].attribution_confidence).toBe('last_known_speaker');
  });

  test('end_ms is bounded between 1s and 8s by text length', async () => {
    const { bridge, captured } = makeBridge();
    // Short text → 1s minimum.
    await bridge._onCaption({ speaker: 'Alice', text: 'hello', ts_ms: 1_000 });
    expect(captured[0].end_ms - captured[0].start_ms).toBe(1_000);
    // Long text → 8s maximum. Use a non-repeating sentence — the
    // hallucinationFilter's hasRepetitionLoop drops "word word word..."
    // patterns and would filter this segment out otherwise.
    const long = 'The quick brown fox jumps over the lazy dog and then runs through the meadow chasing butterflies under a clear blue sky on a warm summer afternoon while children play nearby and birds sing softly.';
    await bridge._onCaption({ speaker: 'Alice', text: long, ts_ms: 1_000 });
    expect(captured[1].end_ms - captured[1].start_ms).toBe(8_000);
  });

  test('returns Unknown speaker when nothing resolves', async () => {
    const { bridge, captured } = makeBridge({ rosterWatcher: null });
    await bridge._onCaption({ speaker: null, text: 'hello there', ts_ms: 1_000 });
    expect(captured[0].speaker).toBe('Unknown speaker');
    expect(captured[0].attribution_confidence).toBe('unknown');
  });
});
