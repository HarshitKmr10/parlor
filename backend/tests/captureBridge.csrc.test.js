'use strict';

// Tests for the CSRC correlation map maintained by CaptureBridge.
// PR #3500 introduced this map as the primary speaker-attribution
// signal post-diarizer-deletion. The map learns
// (csrc_source_id → display_name) when a chunk has exactly ONE CSRC
// firing AND the rosterWatcher resolves a single active-speaker name.
// After CSRC_LOCK_THRESHOLD corroborations the mapping is locked.

const path = require('node:path');
const os = require('node:os');
const { CaptureBridge } = require(path.join('..', 'src', 'bot', 'bot_scripts', 'msteams', 'captureBridge'));

function makeBridge({ rosterWatcher, botName = 'Bot' } = {}) {
  return new CaptureBridge({
    logger: { info() {}, warn() {} },
    scratchDir: os.tmpdir(),
    attributionMode: 'webrtc_csrc',
    rosterWatcher,
    botName,
  });
}

describe('CaptureBridge CSRC correlation', () => {
  test('learns + locks mapping after 3 single-source corroborations', () => {
    let active = 'Harshit Kumar';
    const rosterWatcher = {
      getActiveSpeakerInWindow: () => active,
      snapshot: () => ({ list: [], byName: {}, byPeerId: {} }),
    };
    const bridge = makeBridge({ rosterWatcher });

    bridge._learnCsrcMapping([{ source: 201 }], 'Harshit Kumar');
    expect(bridge._csrcSourceMap.has(201)).toBe(false); // pending only
    bridge._learnCsrcMapping([{ source: 201 }], 'Harshit Kumar');
    expect(bridge._csrcSourceMap.has(201)).toBe(false);
    bridge._learnCsrcMapping([{ source: 201 }], 'Harshit Kumar');
    expect(bridge._csrcSourceMap.get(201)).toBe('Harshit Kumar');
  });

  test('does not lock a candidate that gets contradicted by a different name', () => {
    const bridge = makeBridge({ rosterWatcher: { getActiveSpeakerInWindow: () => null, snapshot: () => ({ list: [] }) } });

    bridge._learnCsrcMapping([{ source: 201 }], 'Alice');
    bridge._learnCsrcMapping([{ source: 201 }], 'Alice');
    // Sudden disagreement — reset candidate, don't lock.
    bridge._learnCsrcMapping([{ source: 201 }], 'Bob');
    expect(bridge._csrcSourceMap.has(201)).toBe(false);
    // Need 3 more corroborations of Bob to lock.
    bridge._learnCsrcMapping([{ source: 201 }], 'Bob');
    bridge._learnCsrcMapping([{ source: 201 }], 'Bob');
    expect(bridge._csrcSourceMap.get(201)).toBe('Bob');
  });

  test('skips learning when more than one CSRC source is firing (overlap)', () => {
    const bridge = makeBridge({ rosterWatcher: { getActiveSpeakerInWindow: () => null, snapshot: () => ({ list: [] }) } });
    // Multi-source = both speakers active. Can't safely attribute the
    // single active-speaker name to one source vs the other → skip.
    bridge._learnCsrcMapping([{ source: 201 }, { source: 414 }], 'Alice');
    bridge._learnCsrcMapping([{ source: 201 }, { source: 414 }], 'Alice');
    bridge._learnCsrcMapping([{ source: 201 }, { source: 414 }], 'Alice');
    expect(bridge._csrcSourceMap.size).toBe(0);
    expect(bridge._csrcCandidates.size).toBe(0);
  });

  test('skips learning when activeSpeakerName is the bot itself', () => {
    const bridge = makeBridge({
      rosterWatcher: { getActiveSpeakerInWindow: () => null, snapshot: () => ({ list: [] }) },
      botName: 'My Bot',
    });
    bridge._learnCsrcMapping([{ source: 201 }], 'My Bot');
    bridge._learnCsrcMapping([{ source: 201 }], 'My Bot');
    bridge._learnCsrcMapping([{ source: 201 }], 'My Bot');
    expect(bridge._csrcSourceMap.size).toBe(0);
  });

  test('once locked, additional contradictions do not unmap', () => {
    const bridge = makeBridge({ rosterWatcher: { getActiveSpeakerInWindow: () => null, snapshot: () => ({ list: [] }) } });
    bridge._learnCsrcMapping([{ source: 201 }], 'Alice');
    bridge._learnCsrcMapping([{ source: 201 }], 'Alice');
    bridge._learnCsrcMapping([{ source: 201 }], 'Alice');
    expect(bridge._csrcSourceMap.get(201)).toBe('Alice');
    // After lock, even a "Bob" reading does not unmap (Alice is sticky).
    bridge._learnCsrcMapping([{ source: 201 }], 'Bob');
    expect(bridge._csrcSourceMap.get(201)).toBe('Alice');
  });

  test('handles non-numeric source defensively', () => {
    const bridge = makeBridge({ rosterWatcher: { getActiveSpeakerInWindow: () => null, snapshot: () => ({ list: [] }) } });
    bridge._learnCsrcMapping([{ source: 'not-a-number' }], 'Alice');
    expect(bridge._csrcSourceMap.size).toBe(0);
    expect(bridge._csrcCandidates.size).toBe(0);
  });
});
