'use strict';

// Regression test for issue #85: the SIGTERM handler called process.exit(0)
// synchronously, right after firing the abort signal, with no await and no
// delay. The real browser/context cleanup lives in joinMeeting()'s finally
// block (context.close() / browser.close()).
//
// Note: aborting removalCtl alone does not make the in-meeting Promise.race
// (removed/alone/trackGone) settle — those watchers only resolve when they
// detect an actual reason (removed_by_admin, alone_grace_elapsed, etc.), not
// merely on `signal.aborted`. So the SIGTERM handler cannot rely solely on
// awaiting the in-flight joinMeeting() call's natural settlement; it also
// directly invokes the same bridge.stop()/context.close()/browser.close()
// cleanup if the bounded wait elapses first. This test proves both halves:
// process.exit() waits for cleanup, and a hung main lifecycle doesn't block
// it forever.
//
// Mocking approach mirrors joinMeeting.voiceWorker.test.js: every heavy
// bot-script submodule is mocked so the real joinMeeting() function can be
// driven down to the in-meeting race without a real browser.

// SIGTERM_CLEANUP_TIMEOUT_MS is read from this env var once, at module load
// time — it must be set BEFORE the require() below, not in beforeEach().
process.env.MSTEAMS_SIGTERM_CLEANUP_MS = '30';

const closeOrder = [];

jest.mock('../src/bot/bot_scripts/msteams/browser', () => ({
  launchBrowser: jest.fn(async () => ({
    close: jest.fn(async () => { closeOrder.push('browser.close'); }),
  })),
  newSession: jest.fn(async () => ({
    newPage: jest.fn(async () => ({
      on: jest.fn(),
      evaluate: jest.fn(async () => ({ micClicked: null, camClicked: null, labels: [] })),
      screenshot: jest.fn(async () => {}),
    })),
    close: jest.fn(async () => { closeOrder.push('context.close'); }),
  })),
}));
jest.mock('../src/bot/bot_scripts/msteams/join', () => ({
  joinMeetingFlow: jest.fn(async () => {}),
  muteMicPostAdmission: jest.fn(async () => {}),
}));
jest.mock('../src/bot/bot_scripts/msteams/admission', () => ({
  TERMINAL: { ADMITTED: 'admitted', TIMEOUT: 'timeout', REMOVED: 'removed' },
  detectInitialState: jest.fn(async () => ({ state: 'admitted' })),
  waitForAdmission: jest.fn(async () => ({ state: 'admitted' })),
}));
jest.mock('../src/bot/bot_scripts/msteams/removal', () => ({
  // Real watchRemoval() resolves its OWN promise on abort (the `while
  // (!signal?.aborted)` loop just returns), but never calls onRemoved — so
  // the wrapping `removed` promise in joinMeeting.js stays pending forever.
  // Model that exactly: resolve this inner promise on abort, call nothing.
  watchRemoval: jest.fn((page, { signal }) => new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    signal?.addEventListener?.('abort', () => resolve(), { once: true });
  })),
}));
jest.mock('../src/bot/bot_scripts/msteams/trackPresence', () => ({
  watchTrackPresence: jest.fn((page, { signal }) => new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    signal?.addEventListener?.('abort', () => resolve(), { once: true });
  })),
}));
jest.mock('../src/bot/bot_scripts/msteams/leave', () => ({
  leaveMeeting: jest.fn(async () => {}),
}));
jest.mock('../src/bot/bot_scripts/msteams/captureBridge', () => ({
  CaptureBridge: jest.fn().mockImplementation(() => ({
    expose: jest.fn(async () => {}),
    stop: jest.fn(async () => { closeOrder.push('bridge.stop'); }),
    stats: { framesIn: 0 },
    roster: null,
  })),
}));
jest.mock('../src/bot/bot_scripts/msteams/transcription', () => ({
  TranscriptionAdapter: jest.fn().mockImplementation(() => ({ providerName: 'mock' })),
}));
jest.mock('../src/bot/bot_scripts/msteams/rosterWatcher', () => ({
  RosterWatcher: jest.fn().mockImplementation(() => ({
    expose: jest.fn(async () => {}),
    setOnChange: jest.fn(),
    start: jest.fn(() => () => {}),
    snapshot: jest.fn(() => []),
  })),
}));
jest.mock('../src/bot/bot_scripts/shared/aloneness', () => ({
  watchAloneness: jest.fn(({ signal }) => new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    signal?.addEventListener?.('abort', () => resolve(), { once: true });
  })),
}));
jest.mock('../src/bot/bot_scripts/msteams/captions', () => ({
  enableLiveCaptions: jest.fn(async () => true),
}));
jest.mock('../src/storage/dbIntegration', () => ({
  markMeetingJoined: jest.fn(async () => {}),
  failMeeting: jest.fn(async () => {}),
  recordExitReason: jest.fn(async () => {}),
}));

const { joinMeeting } = require('../src/bot/bot_scripts/msteams/joinMeeting');

describe('Teams bot — SIGTERM handler awaits/performs browser cleanup (issue #85)', () => {
  let exitSpy;

  beforeEach(() => {
    closeOrder.length = 0;
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
  });

  afterEach(() => {
    exitSpy.mockRestore();
  });

  afterAll(() => {
    process.removeAllListeners('SIGTERM');
  });

  test('SIGTERM triggers real cleanup (bridge.stop -> context.close -> browser.close) before process.exit()', async () => {
    // Kick off a real joinMeeting() call; the in-meeting race (removed/alone/
    // trackGone) never resolves on its own — only abort() makes the mocked
    // watchers' inner promises settle, and per the real implementation that
    // does NOT propagate to the outer `removed`/`alone`/`trackGone` promises.
    // So this call can only ever be unstuck by the SIGTERM handler's direct
    // cleanup invocation, exactly like production.
    // maxMeetingMs is kept short (well outside this test's own assertions,
    // which all complete via the SIGTERM path in well under a second) purely
    // so the fallback setTimeout doesn't leave an 8h open handle in the
    // process after the test finishes.
    joinMeeting('https://teams.microsoft.com/l/meetup-join/sigterm', { name: 'Verdant Bot' }, {
      meetingDbId: 'meeting-teams-sigterm',
      maxMeetingMs: 500,
    });

    // Let the microtask queue drain so joinMeeting() reaches the in-meeting
    // race and registers _activeJoinAbort / _activeCleanup.
    await new Promise((resolve) => setImmediate(resolve));

    expect(process.listenerCount('SIGTERM')).toBeGreaterThan(0);

    // Fire the real SIGTERM event exactly as a k8s pod drain would.
    process.emit('SIGTERM');

    // Immediately after emitting, process.exit() must not have fired yet —
    // the handler is asynchronous and must wait for cleanup first.
    expect(exitSpy).not.toHaveBeenCalled();

    // Wait past the configured bounded timeout so the direct cleanup path
    // runs and resolves.
    await new Promise((resolve) => setTimeout(resolve, 80));

    expect(closeOrder).toEqual(['bridge.stop', 'context.close', 'browser.close']);
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  test('a second SIGTERM with no active join exits immediately without throwing', async () => {
    // No joinMeeting() call in flight in this test — _activeJoinAbort/
    // _activeCleanup should be null/cleared from the previous test's finally
    // block (or never set). The handler must still exit cleanly.
    closeOrder.length = 0;
    process.emit('SIGTERM');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(exitSpy).toHaveBeenCalledWith(0);
  });
});
