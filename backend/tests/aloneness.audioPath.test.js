'use strict';

// Regression tests for the aloneness watcher's audio-path fallback
// (recentAttributedSpeaker callback).
//
// Bug: meeting beb81f9f-c845-45b1-b05a-ae418e5f5b00 — bot dropped at
// exactly 20 min with reason: startup_alone_timeout, ever_saw_others:
// false, despite 121 caption segments having been transcribed during
// the run. The rosterWatcher was completely silent for the full 20 min
// (People panel never rendered tile mutations / DOM observer never
// fired) so even the useHistory: true window was all-zero — and the
// alone counter ran straight to the 20-min ceiling.
//
// Fix: aloneness now optionally consults a recentAttributedSpeaker
// callback. If the callback returns a non-bot speaker name with a
// timestamp within audioFreshMs, the bot is treated as not alone
// regardless of the roster snapshot. Strictly stronger evidence than
// the DOM panel (AWS/Azure attributed real audio to a real human →
// human is present).

const path = require('node:path');
const { watchAloneness } = require(path.join(
  '..', 'src', 'bot', 'bot_scripts', 'shared', 'aloneness',
));

function makeRoster() {
  return {
    list: [],
    snapshot() { return { list: this.list }; },
  };
}

function makeAbortable() {
  const controller = new AbortController();
  return { controller, signal: controller.signal };
}

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

const QUIET_LOGGER = { info() {}, warn() {} };

describe('watchAloneness — audio-path fallback (recentAttributedSpeaker)', () => {
  test('does NOT fire onAlone while audio is being attributed to a real speaker', async () => {
    const roster = makeRoster(); // empty roster the entire test
    const { controller, signal } = makeAbortable();
    const onAlone = jest.fn();
    let now = Date.now();
    const recentAttributedSpeaker = () => ({ name: 'Harshit Kumar', tsMs: now });

    const watcher = watchAloneness({
      roster, signal, onAlone, logger: QUIET_LOGGER,
      botName: 'Bot',
      warmupMs: 0,
      pollIntervalMs: 20,
      startupGraceMs: 500,         // tiny so we'd see the bug fast
      postSpeakerGraceMs: 200,
      recentAttributedSpeaker,
      audioFreshMs: 1_000,
    });

    // Keep the audio attribution fresh by updating `now` every 50 ms
    // for a duration well past the startupGrace.
    for (let i = 0; i < 30; i++) {
      now = Date.now();
      await wait(50);
    }

    expect(onAlone).not.toHaveBeenCalled();
    controller.abort();
    await watcher;
  });

  test('fires onAlone when audio attribution goes stale past audioFreshMs', async () => {
    const roster = makeRoster();
    const { controller, signal } = makeAbortable();
    const onAlone = jest.fn();
    // Stamp a single attribution then never refresh — caller no longer
    // attributes audio (e.g. all speakers stopped talking AND left).
    const staleTs = Date.now();
    const recentAttributedSpeaker = () => ({ name: 'Harshit Kumar', tsMs: staleTs });

    const watcher = watchAloneness({
      roster, signal, onAlone, logger: QUIET_LOGGER,
      botName: 'Bot',
      warmupMs: 0,
      pollIntervalMs: 20,
      startupGraceMs: 1_500,
      postSpeakerGraceMs: 300,
      recentAttributedSpeaker,
      audioFreshMs: 200,           // very short — goes stale fast
    });

    // First ~250 ms the attribution is fresh → flips everSawOthers=true
    // → switches to post-speaker mode (300 ms grace).
    // Then the attribution is stale → grace timer ticks → fires.
    await wait(900);
    expect(onAlone).toHaveBeenCalled();
    expect(onAlone.mock.calls[0][0].reason).toBe('left_alone_timeout');
    controller.abort();
    await watcher;
  });

  test('audio-path overrides empty roster (the beb81f9f-... case)', async () => {
    const roster = makeRoster();   // never populated — rosterWatcher silent
    const { controller, signal } = makeAbortable();
    const onAlone = jest.fn();
    let now = Date.now();
    const recentAttributedSpeaker = () => ({ name: 'Harshit Kumar', tsMs: now });

    const watcher = watchAloneness({
      roster, signal, onAlone, logger: QUIET_LOGGER,
      botName: 'Bot',
      warmupMs: 0,
      pollIntervalMs: 20,
      startupGraceMs: 200,         // would fire fast on roster-only
      postSpeakerGraceMs: 100,
      useHistory: true,            // even with this, all-zero history
      historyWindowMs: 100,        // would otherwise still bail
      recentAttributedSpeaker,
      audioFreshMs: 500,
    });

    // Refresh attribution for 600 ms — way longer than startupGraceMs
    // would have allowed roster-only.
    for (let i = 0; i < 30; i++) {
      now = Date.now();
      await wait(20);
    }
    expect(onAlone).not.toHaveBeenCalled();
    controller.abort();
    await watcher;
  });

  test('rejects bot-named audio attributions', async () => {
    const roster = makeRoster();
    const { controller, signal } = makeAbortable();
    const onAlone = jest.fn();
    // Callback returns the bot itself — should NOT count as a human.
    let now = Date.now();
    const recentAttributedSpeaker = () => ({ name: 'AIOps Bot', tsMs: now });

    const watcher = watchAloneness({
      roster, signal, onAlone, logger: QUIET_LOGGER,
      botName: 'AIOps Bot',
      warmupMs: 0,
      pollIntervalMs: 20,
      startupGraceMs: 300,
      postSpeakerGraceMs: 100,
      recentAttributedSpeaker,
      audioFreshMs: 500,
    });

    for (let i = 0; i < 25; i++) {
      now = Date.now();
      await wait(20);
    }
    // Bot-named attributions are filtered out → roster is also empty
    // → startup grace fires.
    expect(onAlone).toHaveBeenCalled();
    expect(onAlone.mock.calls[0][0].reason).toBe('startup_alone_timeout');
    controller.abort();
    await watcher;
  });

  test('callback throwing does not break the watch', async () => {
    const roster = makeRoster();
    roster.list = [{ name: 'Alice' }];   // roster carries us
    const { controller, signal } = makeAbortable();
    const onAlone = jest.fn();
    const recentAttributedSpeaker = () => { throw new Error('boom'); };

    const watcher = watchAloneness({
      roster, signal, onAlone, logger: QUIET_LOGGER,
      botName: 'Bot',
      warmupMs: 0,
      pollIntervalMs: 20,
      startupGraceMs: 500,
      postSpeakerGraceMs: 200,
      recentAttributedSpeaker,
      audioFreshMs: 1_000,
    });

    await wait(300);
    expect(onAlone).not.toHaveBeenCalled();   // alice still in roster
    controller.abort();
    await watcher;
  });

  test('legacy behavior preserved when callback omitted', async () => {
    // No recentAttributedSpeaker passed — empty roster + tiny grace
    // should still fire on the legacy roster-only path.
    const roster = makeRoster();
    const { controller, signal } = makeAbortable();
    const onAlone = jest.fn();

    const watcher = watchAloneness({
      roster, signal, onAlone, logger: QUIET_LOGGER,
      botName: 'Bot',
      warmupMs: 0,
      pollIntervalMs: 20,
      startupGraceMs: 200,
      postSpeakerGraceMs: 100,
    });

    await wait(400);
    expect(onAlone).toHaveBeenCalled();
    controller.abort();
    await watcher;
  });
});
