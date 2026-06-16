'use strict';

// Regression tests for the aloneness watcher's useHistory flag.
// Bug: meeting b00bbd6f-... — bot left mid-meeting (~21 min) while
// participants were actively talking. Root cause: aloneness polls
// roster.snapshot() every 1s; when the participant panel DOM flickers
// (tile re-mount during simulcast layer change) the snapshot
// momentarily reports 0 humans, the alone counter increments, and
// after enough flickers the bot decides everyone left.
//
// Fix: useHistory: true keeps a rolling window of recent samples and
// only treats the bot as "alone" if EVERY sample within the window
// reported 0 humans. A flicker no longer trips the timer.
//
// Tests use real timers with sub-second pollIntervalMs so they're
// fast (~100s of ms each) — fake timers + the watcher's setTimeout
// loop don't compose cleanly.

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

describe('watchAloneness — useHistory', () => {
  test('does NOT fire onAlone when a single flicker reports 0 humans within the window', async () => {
    const roster = makeRoster();
    roster.list = [{ name: 'Alice' }];
    const { controller, signal } = makeAbortable();
    const onAlone = jest.fn();

    const watcher = watchAloneness({
      roster, signal, onAlone, logger: QUIET_LOGGER,
      botName: 'Bot',
      warmupMs: 0,
      pollIntervalMs: 20,
      historyWindowMs: 200,        // 10 ticks
      postSpeakerGraceMs: 600,     // alone for 600ms before timeout fires
    });

    await wait(100);             // Alice present for 5 ticks
    roster.list = [];            // single flicker
    await wait(40);              // 2 ticks of empty roster
    roster.list = [{ name: 'Alice' }]; // Alice back
    await wait(120);             // 6 ticks with Alice present

    expect(onAlone).not.toHaveBeenCalled();

    controller.abort();
    await watcher;
  });

  test('DOES fire onAlone after sustained absence past postSpeakerGraceMs', async () => {
    const roster = makeRoster();
    roster.list = [{ name: 'Alice' }];
    const { controller, signal } = makeAbortable();
    const onAlone = jest.fn();

    const watcher = watchAloneness({
      roster, signal, onAlone, logger: QUIET_LOGGER,
      botName: 'Bot',
      warmupMs: 0,
      pollIntervalMs: 20,
      historyWindowMs: 100,         // small window
      postSpeakerGraceMs: 1_000,    // alone after 1s solid silence
    });

    await wait(60);                // Alice present → everSawOthers=true
    roster.list = [];
    await wait(1_400);             // 1.4s solid empty — past 1s threshold
    expect(onAlone).toHaveBeenCalled();
    expect(onAlone.mock.calls[0][0].reason).toBe('left_alone_timeout');

    controller.abort();
    await watcher;
  });

  test('legacy behavior preserved when useHistory is omitted (default false)', async () => {
    const roster = makeRoster();
    roster.list = [{ name: 'Alice' }];
    const { controller, signal } = makeAbortable();
    const onAlone = jest.fn();

    const watcher = watchAloneness({
      roster, signal, onAlone, logger: QUIET_LOGGER,
      botName: 'Bot',
      warmupMs: 0,
      pollIntervalMs: 20,
      postSpeakerGraceMs: 1_000,
      // useHistory NOT passed → default false → snapshot-only behavior
    });

    await wait(60);
    roster.list = [];
    await wait(1_400);
    expect(onAlone).toHaveBeenCalled();

    controller.abort();
    await watcher;
  });

  test('startup grace applies until first human seen', async () => {
    const roster = makeRoster();
    roster.list = []; // no one in the meeting yet
    const { controller, signal } = makeAbortable();
    const onAlone = jest.fn();

    const watcher = watchAloneness({
      roster, signal, onAlone, logger: QUIET_LOGGER,
      botName: 'Bot',
      warmupMs: 0,
      pollIntervalMs: 20,
      startupGraceMs: 1_000,
      postSpeakerGraceMs: 200,
      useHistory: true,
    });

    await wait(400);    // < 1s — should NOT fire
    expect(onAlone).not.toHaveBeenCalled();
    await wait(900);    // pushed past startup grace
    expect(onAlone).toHaveBeenCalled();
    expect(onAlone.mock.calls[0][0].reason).toBe('startup_alone_timeout');

    controller.abort();
    await watcher;
  });

  test('bot-named participants do not count as humans', async () => {
    const roster = makeRoster();
    roster.list = [{ name: 'AIOps Bot' }, { name: 'Test Bot' }];
    const { controller, signal } = makeAbortable();
    const onAlone = jest.fn();

    const watcher = watchAloneness({
      roster, signal, onAlone, logger: QUIET_LOGGER,
      botName: 'AIOps Bot',
      warmupMs: 0,
      pollIntervalMs: 20,
      startupGraceMs: 500,
      postSpeakerGraceMs: 200,
      useHistory: true,
    });

    await wait(900);
    expect(onAlone).toHaveBeenCalled();

    controller.abort();
    await watcher;
  });
});
