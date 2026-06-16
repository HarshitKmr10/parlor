'use strict';

const { ClosedCaptionManager } = require('../src/bot/bot_scripts/msteams/closedCaptionManager');

describe('ClosedCaptionManager', () => {
  test('holds partial captions until a final update arrives', async () => {
    const saved = [];
    const manager = new ClosedCaptionManager({
      logger: { warn() {} },
      saveCaptionCallback: async (message) => saved.push(message),
    });

    manager.upsertCaption({
      deviceId: '8:user:alice',
      captionId: 'caption-1',
      speakerName: 'Alice',
      text: 'hello wor',
      receivedAtMs: 1000,
      audioTimestampMs: 900,
      isFinal: false,
    }, 1000);
    await manager.processCaptions({ nowMs: 1100 });

    expect(saved).toHaveLength(0);

    manager.upsertCaption({
      deviceId: '8:user:alice',
      captionId: 'caption-1',
      speakerName: 'Alice',
      text: 'hello world from Teams',
      receivedAtMs: 2500,
      audioTimestampMs: 900,
      isFinal: true,
    }, 2500);
    await manager.processCaptions({ nowMs: 2500 });

    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      device_id: '8:user:alice',
      caption_id: 'caption-1',
      speaker_name: 'Alice',
      timestamp_ms: 900,
      duration_ms: 1500,
      text: 'hello world from Teams',
      source_uuid_suffix: '8:user:alice-caption-1',
      is_final: true,
    });
  });

  test('flushes an unfinished caption at shutdown', async () => {
    const saved = [];
    const manager = new ClosedCaptionManager({
      logger: { warn() {} },
      saveCaptionCallback: async (message) => saved.push(message),
    });

    manager.upsertCaption({
      deviceId: '8:user:bob',
      captionId: 'caption-2',
      speakerName: 'Bob',
      text: 'partial but useful',
      receivedAtMs: 3000,
      isFinal: false,
    }, 3000);

    await manager.flushCaptions();

    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      speaker_name: 'Bob',
      text: 'partial but useful',
      is_final: false,
    });
  });
});
