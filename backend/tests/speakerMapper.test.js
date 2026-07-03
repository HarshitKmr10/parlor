'use strict';

// Regression tests for attributeFromTrack — the per-track
// attribution helper that surfaces real names from the rosterWatcher
// snapshot. Two staging-meeting bugs (73fa5bf7-...) drove these:
//
//   1. The implementation expected `roster.list` to be an array of
//      {name} objects but RosterWatcher.snapshot().list returns a plain
//      string[]. The old `.map((p) => p?.name)` mapped every entry to
//      undefined, so `humans` was always empty and roster_solo never
//      fired. Test: "extracts strings directly".
//
//   2. The bot-filter was hardcoded `/bot/i`, which only matches the
//      literal substring "bot". Bot names like "Test" / "ABC" /
//      "AIOps" passed through as humans, competing with the real
//      participant and defeating roster_solo. Test: "filters by
//      explicit botName param".

const path = require('node:path');
const { attributeFromTrack } = require(path.join('..', 'src', 'bot', 'bot_scripts', 'msteams', 'speakerMapper'));

describe('attributeFromTrack', () => {
  // ─── CSRC attribution (highest-priority path post-PR-3500) ─────────
  test('csrcSources with a learned name takes priority over activeSpeakerName', () => {
    // CSRC is voice-independent + overlap-aware → trumps the DOM
    // active-speaker tile when both signals are present.
    const out = attributeFromTrack({
      peerId: 2,
      trackId: 't1',
      peerLabel: 'Speaker 2',
      roster: { list: [] },
      activeSpeakerName: 'Bob',  // DOM says Bob
      botName: 'Bot',
      csrcSources: [{ source: 201, name: 'Alice', audioLevel: 50 }],
    });
    expect(out.confidence).toBe('csrc_match');
    expect(out.speaker).toBe('Alice');
  });

  test('csrcSources picks the dominant source by audioLevel (lower = louder per RFC 6464)', () => {
    const out = attributeFromTrack({
      peerId: 2,
      trackId: 't1',
      peerLabel: 'Speaker 2',
      roster: { list: [] },
      activeSpeakerName: null,
      botName: 'Bot',
      csrcSources: [
        { source: 201, name: 'Alice', audioLevel: 80 },
        { source: 414, name: 'Bob', audioLevel: 30 },  // loudest
        { source: 510, name: 'Carol', audioLevel: 110 },
      ],
    });
    expect(out.confidence).toBe('csrc_match');
    expect(out.speaker).toBe('Bob');
    expect(out.csrc_sources).toEqual([
      { source: 201, name: 'Alice' },
      { source: 414, name: 'Bob' },
      { source: 510, name: 'Carol' },
    ]);
  });

  test('csrcSources with NO matched names falls through to next layer', () => {
    // None of the CSRCs have been correlated to a name yet (cold start).
    // Should fall through to roster_active / roster_solo / etc.
    const out = attributeFromTrack({
      peerId: 2,
      trackId: 't1',
      peerLabel: 'Speaker 2',
      roster: { list: ['Jane Doe'] },
      activeSpeakerName: null,
      botName: 'Bot',
      csrcSources: [{ source: 201, name: null, audioLevel: 50 }],
    });
    expect(out.confidence).toBe('roster_solo');
    expect(out.speaker).toBe('Jane Doe');
  });

  test('csrcSources empty/undefined falls through to existing chain', () => {
    const out = attributeFromTrack({
      peerId: 2,
      trackId: 't1',
      peerLabel: 'Speaker 2',
      roster: { list: ['Jane Doe'] },
      activeSpeakerName: 'Jane Doe',
      botName: 'Bot',
      csrcSources: [],
    });
    expect(out.confidence).toBe('roster_active');
    expect(out.speaker).toBe('Jane Doe');
  });

  test('uses activeSpeakerName when available (roster_active)', () => {
    const out = attributeFromTrack({
      peerId: 2,
      trackId: 't1',
      peerLabel: 'Speaker 2',
      roster: { list: ['Test', 'Jane Doe'] },
      activeSpeakerName: 'Jane Doe',
      botName: 'Test',
    });
    expect(out.confidence).toBe('roster_active');
    expect(out.speaker).toBe('Jane Doe');
  });

  test('roster_solo fires when one human + bot are in the list (botName="Test")', () => {
    // Regression found during testing — the bot was named
    // "Test" and segments came back as "Speaker 2" because the prior
    // /bot/i filter didn't match "Test", so humans.length was 2.
    const out = attributeFromTrack({
      peerId: 2,
      trackId: 't1',
      peerLabel: 'Speaker 2',
      roster: { list: ['Test', 'Jane Doe'] },
      activeSpeakerName: null,
      botName: 'Test',
    });
    expect(out.confidence).toBe('roster_solo');
    expect(out.speaker).toBe('Jane Doe');
  });

  test('roster_solo also fires when bot name is "ABC"', () => {
    const out = attributeFromTrack({
      peerId: 2,
      trackId: 't1',
      peerLabel: 'Speaker 2',
      roster: { list: ['ABC', 'Jane Doe'] },
      activeSpeakerName: null,
      botName: 'ABC',
    });
    expect(out.confidence).toBe('roster_solo');
    expect(out.speaker).toBe('Jane Doe');
  });

  test('extracts strings directly (regression: list is string[], not {name}[])', () => {
    const out = attributeFromTrack({
      peerId: 2,
      trackId: 't1',
      peerLabel: 'Speaker 2',
      roster: { list: ['Jane Doe'] }, // bare strings
      activeSpeakerName: null,
      botName: 'AIOps Bot',
    });
    expect(out.confidence).toBe('roster_solo');
    expect(out.speaker).toBe('Jane Doe');
  });

  test('REGRESSION: handles {name, speaking} objects from rosterWatcher.snapshot()', () => {
    // rosterWatcher.snapshot().list ACTUALLY returns objects like
    // {name, speaking}, not bare strings. Every prior PR's fix (#3490
    // sticky/sole-seen, #3495 botName filter, #3496 cumulative seen,
    // #3498 captureBridge wiring) silently dropped these because
    // `typeof entry === 'string'` is false for objects → roster_solo
    // never fired → "Speaker N" still appeared in transcripts.
    // Verified live during testing, where bot was
    // "ABC TESTING" and Jane was the only human; segments still
    // came back as Speaker 2 / peer_label.
    const out = attributeFromTrack({
      peerId: 2,
      trackId: 't1',
      peerLabel: 'Speaker 2',
      roster: { list: [
        { name: 'ABC TESTING', speaking: false },
        { name: 'Jane Doe', speaking: true },
      ] },
      activeSpeakerName: null,
      botName: 'ABC TESTING',
    });
    expect(out.confidence).toBe('roster_solo');
    expect(out.speaker).toBe('Jane Doe');
  });

  test('REGRESSION: object list with no botName still picks the lone human', () => {
    const out = attributeFromTrack({
      peerId: 2,
      trackId: 't1',
      peerLabel: 'Speaker 2',
      roster: { list: [{ name: 'Jane Doe', speaking: true }] },
      activeSpeakerName: null,
    });
    expect(out.confidence).toBe('roster_solo');
    expect(out.speaker).toBe('Jane Doe');
  });

  test('falls back to lastBoundSpeaker when 2+ humans + no active speaker (avoids Speaker N)', () => {
    // User's explicit ask: "if you don't know who is speaking, just
    // map it to the previous user". Better than emitting "Speaker N".
    const out = attributeFromTrack({
      peerId: 2,
      trackId: 't1',
      peerLabel: 'Speaker 2',
      roster: { list: ['Bot', 'Alice', 'Bob'] },
      activeSpeakerName: null,
      botName: 'Bot',
      lastBoundSpeaker: 'Alice',
    });
    expect(out.confidence).toBe('last_known_speaker');
    expect(out.speaker).toBe('Alice');
  });

  test('falls back to lastBoundSpeaker when roster is empty (cold-start race)', () => {
    const out = attributeFromTrack({
      peerId: 5,
      trackId: 't1',
      peerLabel: 'Speaker 5',
      roster: { list: [] },
      activeSpeakerName: null,
      botName: 'Bot',
      lastBoundSpeaker: 'Jane Doe',
    });
    expect(out.confidence).toBe('last_known_speaker');
    expect(out.speaker).toBe('Jane Doe');
  });

  test('soft-label fallback only when NO lastBoundSpeaker either (true cold start)', () => {
    const out = attributeFromTrack({
      peerId: 5,
      trackId: 't1',
      peerLabel: 'Speaker 5',
      roster: { list: [] },
      activeSpeakerName: null,
      botName: 'Bot',
      // no lastBoundSpeaker — first chunk of a meeting before anyone has spoken
    });
    expect(out.confidence).toBe('fallback');
    expect(out.speaker).toBe('Unknown speaker');
    // Critically: never raw "Speaker N".
    expect(out.speaker).not.toMatch(/^Speaker\s*\d+$/);
  });

  test('handles missing botName gracefully (no filter, all entries treated as humans)', () => {
    const out = attributeFromTrack({
      peerId: 2,
      trackId: 't1',
      peerLabel: 'Speaker 2',
      roster: { list: ['Jane Doe'] },
      activeSpeakerName: null,
      // botName: undefined
    });
    expect(out.confidence).toBe('roster_solo');
    expect(out.speaker).toBe('Jane Doe');
  });
});
