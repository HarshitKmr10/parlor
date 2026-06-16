'use strict';

const path = require('node:path');
const {
  TranscriptCleanup,
  parseCleanupResponse,
} = require(path.join('..', 'src', 'processors', 'transcriptCleanup'));

describe('parseCleanupResponse', () => {
  test('extracts cleaned_segments from canonical JSON', () => {
    const raw = JSON.stringify({
      cleaned_segments: [
        { original_indices: [0], speaker: 'Alice', text: 'hi', start_ms: 0, end_ms: 100, reason: 'keep' },
      ],
    });
    expect(parseCleanupResponse(raw).cleaned_segments).toHaveLength(1);
  });

  test('strips ```json fences', () => {
    const raw = '```json\n{"cleaned_segments":[{"text":"x"}]}\n```';
    expect(parseCleanupResponse(raw).cleaned_segments).toHaveLength(1);
  });

  test('tolerates a top-level array shape', () => {
    const raw = JSON.stringify([{ text: 'a' }, { text: 'b' }]);
    expect(parseCleanupResponse(raw).cleaned_segments).toHaveLength(2);
  });

  test('returns empty on garbage', () => {
    expect(parseCleanupResponse('not json').cleaned_segments).toEqual([]);
    expect(parseCleanupResponse(null).cleaned_segments).toEqual([]);
  });
});

describe('TranscriptCleanup chunking', () => {
  test('chunks with overlap and dedupes overlapping outputs', async () => {
    const segments = Array.from({ length: 110 }, (_, i) => ({
      bound_speaker: i % 2 === 0 ? 'Alice' : 'Bob',
      text: `seg${i}`,
      start_ms: i * 1_000,
      end_ms: i * 1_000 + 500,
      provider: 'test',
    }));

    // Stub the Bedrock invocation: each chunk just echoes its inputs back.
    const stub = {
      _bedrockClient: {
        send: async (cmd) => {
          // Decode the body to know which chunk we're on.
          const body = JSON.parse(cmd.input?.body || cmd.body || '{}');
          const userMsg = body.messages?.[0]?.content || '[]';
          const parsed = JSON.parse(userMsg);
          const echoed = (parsed.segments || []).map((s) => ({
            original_indices: [s.idx],
            speaker: s.speaker,
            text: s.text,
            start_ms: s.start_ms,
            end_ms: s.end_ms,
            reason: 'keep',
          }));
          return {
            body: new TextEncoder().encode(JSON.stringify({
              content: [{ text: JSON.stringify({ cleaned_segments: echoed }) }],
            })),
          };
        },
      },
      _BedrockInvokeCmd: class { constructor(input) { this.input = input; } },
    };

    const cleaner = new TranscriptCleanup({
      provider: 'bedrock',
      bedrockClient: stub._bedrockClient,
      logger: { info() {}, warn() {} },
    });
    cleaner._bedrockClient = stub._bedrockClient;
    cleaner._BedrockInvokeCmd = stub._BedrockInvokeCmd;

    const out = await cleaner.clean(segments, [{ name: 'Alice' }, { name: 'Bob' }]);
    // After dedup we should have exactly 110 unique outputs.
    expect(out).toHaveLength(110);
    // Indices should round-trip 0..109.
    const idxs = out.flatMap((s) => s.original_indices).sort((a, b) => a - b);
    expect(idxs[0]).toBe(0);
    expect(idxs[idxs.length - 1]).toBe(109);
  });

  test('fail-open: emits keep on chunk error', async () => {
    const stub = {
      _bedrockClient: { send: async () => { throw new Error('bedrock down'); } },
      _BedrockInvokeCmd: class { constructor(input) { this.input = input; } },
    };
    const cleaner = new TranscriptCleanup({ provider: 'bedrock', logger: { info() {}, warn() {} } });
    cleaner._bedrockClient = stub._bedrockClient;
    cleaner._BedrockInvokeCmd = stub._BedrockInvokeCmd;

    const out = await cleaner.clean(
      [{ bound_speaker: 'Alice', text: 'x', start_ms: 0, end_ms: 1, provider: 't' }],
      [],
    );
    expect(out).toHaveLength(1);
    expect(out[0].reason).toBe('keep');
  });
});
