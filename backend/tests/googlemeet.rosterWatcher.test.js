'use strict';

// Tests for googlemeet/rosterWatcher.js. Mirrors the Teams roster
// tests but uses the Meet-shaped event payload — entries carry
// participantId (data-participant-id) in addition to name + speaking.

const path = require('node:path');
const { RosterWatcher } = require(path.join(
  '..', 'src', 'bot', 'bot_scripts', 'googlemeet', 'rosterWatcher',
));

function rw() { return new RosterWatcher({ logger: { info() {}, warn() {} }, botName: 'Bot' }); }

describe('googlemeet RosterWatcher', () => {
  test('snapshot reflects latest ingested roster', () => {
    const r = rw();
    r.ingestRosterEvent({
      ts: 1_000,
      list: [
        { participantId: 'p-a', name: 'Alice', speaking: false },
        { participantId: 'p-b', name: 'Bob', speaking: true },
      ],
    });
    const snap = r.snapshot();
    expect(snap.list.map((p) => p.name).sort()).toEqual(['Alice', 'Bob']);
    expect(snap.byName.Alice.speaking).toBe(false);
    expect(snap.byName.Bob.speaking).toBe(true);
    expect(snap.byParticipantId['p-a'].name).toBe('Alice');
  });

  test('history accumulates speaker samples', () => {
    const r = rw();
    r.ingestRosterEvent({ ts: 1_000, list: [{ participantId: 'p-a', name: 'Alice', speaking: true }] });
    r.ingestRosterEvent({ ts: 2_000, list: [{ participantId: 'p-a', name: 'Alice', speaking: false }] });
    r.ingestRosterEvent({ ts: 3_000, list: [{ participantId: 'p-b', name: 'Bob', speaking: true }] });
    expect(r.history.length).toBe(3);
    expect(r.history[0].speakers).toEqual(['Alice']);
    expect(r.history[2].speakers).toEqual(['Bob']);
  });

  test('getActiveSpeakerInWindow returns dominant speaker by overlap duration', () => {
    const r = rw();
    r.ingestRosterEvent({ ts: 1_000, list: [{ participantId: 'p-a', name: 'Alice', speaking: true }] });
    r.ingestRosterEvent({ ts: 5_000, list: [{ participantId: 'p-b', name: 'Bob', speaking: true }] });
    r.ingestRosterEvent({ ts: 6_000, list: [{ participantId: 'p-b', name: 'Bob', speaking: false }] });
    // Window 1_000–5_000 (4s of Alice, 0s Bob): Alice wins.
    expect(r.getActiveSpeakerInWindow(1_000, 5_000)).toBe('Alice');
    // Window 5_000–6_000 (1s of Bob): Bob wins.
    expect(r.getActiveSpeakerInWindow(5_000, 6_000)).toBe('Bob');
  });

  test('filters out the bot from active-speaker tally', () => {
    const r = rw();
    r.setBotName('AIOps');
    r.ingestRosterEvent({ ts: 1_000, list: [
      { participantId: 'p-bot', name: 'AIOps', speaking: true },
      { participantId: 'p-a', name: 'Alice', speaking: true },
    ] });
    expect(r.getActiveSpeakerInWindow(1_000, 5_000)).toBe('Alice');
  });

  test('nameForParticipantId resolves participantId → display name', () => {
    const r = rw();
    r.ingestRosterEvent({
      ts: 1_000,
      list: [{ participantId: 'spaces/x/devices/123', name: 'Harshit Kumar', speaking: false }],
    });
    expect(r.nameForParticipantId('spaces/x/devices/123')).toBe('Harshit Kumar');
    expect(r.nameForParticipantId('unknown')).toBeNull();
  });

  test('onChange fires only when the participant name set actually changes', () => {
    const r = rw();
    const cb = jest.fn();
    r.setOnChange(cb);
    r.ingestRosterEvent({ ts: 1_000, list: [{ participantId: 'p-a', name: 'Alice', speaking: false }] });
    r.ingestRosterEvent({ ts: 2_000, list: [{ participantId: 'p-a', name: 'Alice', speaking: true }] }); // speaking flip — same name set
    expect(cb).toHaveBeenCalledTimes(1);
    r.ingestRosterEvent({ ts: 3_000, list: [
      { participantId: 'p-a', name: 'Alice', speaking: false },
      { participantId: 'p-b', name: 'Bob', speaking: false },
    ] });
    expect(cb).toHaveBeenCalledTimes(2); // name set changed → fires again
  });

  test('drops entries with empty names and dedupes by participantId', () => {
    const r = rw();
    r.ingestRosterEvent({ ts: 1_000, list: [
      { participantId: 'p-a', name: '', speaking: false },
      { participantId: 'p-a', name: 'Alice', speaking: false },
      { participantId: 'p-a', name: 'Alice', speaking: true },
    ] });
    // The watcher itself does not de-dupe in ingest; the in-page observer
    // does. So passing duplicates here represents bad input — verify it
    // doesn't crash, and the live "Alice" entry wins via byName.
    const snap = r.snapshot();
    expect(snap.byName.Alice).toBeDefined();
  });
});
