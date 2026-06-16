'use strict';

const os = require('node:os');
const path = require('node:path');
const { CaptureBridge } = require(path.join('..', 'src', 'bot', 'bot_scripts', 'msteams', 'captureBridge'));
const { TRANSCRIPT_SOURCE, normalizeTranscriptSource } = require(path.join('..', 'src', 'bot', 'bot_scripts', 'msteams', 'transcriptSource'));

function makeBridge(overrides = {}) {
  const segments = [];
  const bridge = new CaptureBridge({
    logger: { info() {}, warn() {} },
    scratchDir: os.tmpdir(),
    attributionMode: 'webrtc_csrc',
    transcriptSource: TRANSCRIPT_SOURCE.TEAMS_CAPTIONS,
    onSegment: async (segment) => segments.push(segment),
    ...overrides,
  });
  return { bridge, segments };
}

describe('CaptureBridge Teams captions mode', () => {
  test('normalizes aliases to teams_captions', () => {
    expect(normalizeTranscriptSource('closed_caption_from_platform')).toBe(TRANSCRIPT_SOURCE.TEAMS_CAPTIONS);
    expect(normalizeTranscriptSource('captions')).toBe(TRANSCRIPT_SOURCE.TEAMS_CAPTIONS);
    expect(normalizeTranscriptSource('')).toBe(TRANSCRIPT_SOURCE.CSRC_ASR);
  });

  test('publishes only finalized caption updates', async () => {
    const { bridge, segments } = makeBridge();

    await bridge._onCaptionUpdate({
      deviceId: '8:user:alice',
      captionId: 'caption-1',
      speakerName: 'Alice',
      text: 'hello wor',
      receivedAtMs: 1000,
      audioTimestampMs: 900,
      isFinal: false,
    });
    expect(segments).toHaveLength(0);

    await bridge._onCaptionUpdate({
      deviceId: '8:user:alice',
      captionId: 'caption-1',
      speakerName: 'Alice',
      text: 'hello world from Teams',
      receivedAtMs: 2500,
      audioTimestampMs: 900,
      isFinal: true,
    });

    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({
      id: 'caption_8:user:alice-caption-1',
      speaker: 'Alice',
      speaker_id: 'name-alice',
      attribution_confidence: 'platform_caption',
      start_ms: 900,
      end_ms: 2400,
      provider: 'teams_captions',
      kind: 'caption',
      text: 'hello world from Teams',
      source: 'closed_caption_from_platform',
      device_id: '8:user:alice',
      caption_id: 'caption-1',
      is_final: true,
    });
  });

  test('flushes partial captions on stop', async () => {
    const { bridge, segments } = makeBridge();

    await bridge._onCaptionUpdate({
      deviceId: '8:user:bob',
      captionId: 'caption-2',
      speakerName: 'Bob',
      text: 'partial but useful',
      receivedAtMs: 3000,
      isFinal: false,
    });
    expect(segments).toHaveLength(0);

    await bridge.stop();

    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({
      speaker: 'Bob',
      text: 'partial but useful',
      provider: 'teams_captions',
      is_final: false,
    });
  });

  test('caption source skips audio chunk ASR processing', async () => {
    const transcribe = jest.fn();
    const { bridge } = makeBridge({
      attributionMode: 'dom',
      transcription: { transcribe, providerName: 'test_asr' },
    });

    await bridge._onChunk({
      trackId: 'track-1',
      peerId: 'peer-1',
      ts_start_ms: 1000,
      ts_end_ms: 2000,
      sample_rate: 16000,
      wav_b64: Buffer.alloc(44).toString('base64'),
      rms: 1,
    });

    expect(transcribe).not.toHaveBeenCalled();
    expect(bridge.stats.skippedCaptionMode).toBe(1);
  });

  test('captions update feeds aloneness watcher via getRecentAttributedSpeaker', async () => {
    // Regression: in teams_captions mode the bridge's STT/CSRC paths are
    // inactive, so before this fix getRecentAttributedSpeaker stayed null
    // for the entire call and the aloneness watcher bailed at the post-
    // speaker grace despite captions flowing (see meeting 5a277436...
    // which left at 25:58 with full caption transcript).
    const { bridge } = makeBridge();

    expect(bridge.getRecentAttributedSpeaker()).toBeNull();

    const before = Date.now();
    await bridge._onCaptionUpdate({
      deviceId: '8:user:carol',
      captionId: 'caption-3',
      speakerName: 'Carol',
      text: 'are you there',
      receivedAtMs: 5000,
      audioTimestampMs: 4800,
      isFinal: true,
    });

    const recent = bridge.getRecentAttributedSpeaker();
    expect(recent).not.toBeNull();
    expect(recent.name).toBe('Carol');
    expect(recent.tsMs).toBeGreaterThanOrEqual(before);
  });

  test('captions update ignores bot-shaped speakers', async () => {
    const { bridge } = makeBridge({ botName: 'AI Notetaker' });
    await bridge._onCaptionUpdate({
      deviceId: '8:user:bot',
      captionId: 'caption-4',
      speakerName: 'AI Notetaker',
      text: 'this is the bot',
      receivedAtMs: 6000,
      isFinal: true,
    });
    expect(bridge.getRecentAttributedSpeaker()).toBeNull();
  });
});
