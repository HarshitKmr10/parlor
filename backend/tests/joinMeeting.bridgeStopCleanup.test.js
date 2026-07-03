'use strict';

// Regression test for issue #86: CaptureBridge.stop() was only called on the
// success path (inside the try block, before leaveMeeting), never on the
// catch/error path for mid-meeting failures (e.g. a Playwright eval error
// after admission). That left the bridge's audio capture pipeline running
// past the meeting lifecycle on every error exit. bridge.stop() must now run
// unconditionally in the finally block, on both success and error exits.
//
// Mocking approach mirrors joinMeeting.voiceWorker.test.js: every heavy
// bot-script submodule is mocked so the real joinMeeting() function can be
// driven down to a specific point in its lifecycle without a real browser.
// roster.start() throwing (unwrapped in the source, unlike most other
// post-admission calls) is the same technique voiceWorker.test.js uses to
// simulate a mid-meeting fault landing in the outer catch block.

jest.mock('../src/bot/bot_scripts/msteams/browser', () => ({
  launchBrowser: jest.fn(async () => ({ close: jest.fn(async () => {}) })),
  newSession: jest.fn(async () => ({
    newPage: jest.fn(async () => ({
      on: jest.fn(),
      evaluate: jest.fn(async () => ({ micClicked: null, camClicked: null, labels: [] })),
      screenshot: jest.fn(async () => {}),
    })),
    close: jest.fn(async () => {}),
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
  watchRemoval: jest.fn(() => new Promise(() => {})),
}));
jest.mock('../src/bot/bot_scripts/msteams/trackPresence', () => ({
  watchTrackPresence: jest.fn(() => new Promise(() => {})),
}));
jest.mock('../src/bot/bot_scripts/msteams/leave', () => ({
  leaveMeeting: jest.fn(async () => {}),
}));

const mockStop = jest.fn(async () => {});
jest.mock('../src/bot/bot_scripts/msteams/captureBridge', () => ({
  CaptureBridge: jest.fn().mockImplementation(() => ({
    expose: jest.fn(async () => {}),
    stop: mockStop,
    stats: { framesIn: 0 },
    roster: null,
  })),
}));
jest.mock('../src/bot/bot_scripts/msteams/transcription', () => ({
  TranscriptionAdapter: jest.fn().mockImplementation(() => ({ providerName: 'mock' })),
}));

const mockRosterStart = jest.fn(() => { throw new Error('mid_meeting_fault_after_admission'); });
jest.mock('../src/bot/bot_scripts/msteams/rosterWatcher', () => ({
  RosterWatcher: jest.fn().mockImplementation(() => ({
    expose: jest.fn(async () => {}),
    setOnChange: jest.fn(),
    start: mockRosterStart,
    snapshot: jest.fn(() => []),
  })),
}));
jest.mock('../src/bot/bot_scripts/shared/aloneness', () => ({
  watchAloneness: jest.fn(() => new Promise(() => {})),
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

describe('Teams bot — bridge.stop() runs unconditionally (issue #86)', () => {
  beforeEach(() => {
    mockStop.mockClear();
  });

  test('bridge.stop() is called on the mid-meeting error path (post-admission throw)', async () => {
    const result = await joinMeeting('https://teams.microsoft.com/l/meetup-join/err', { name: 'Verdant Bot' }, {
      meetingDbId: 'meeting-teams-bridge-stop-err',
    });

    // The intentional post-admission throw reached the outer catch handler.
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/mid_meeting_fault_after_admission/);

    // bridge.stop() must still have run despite the error exit.
    expect(mockStop).toHaveBeenCalledTimes(1);
  });

  test('bridge.stop() is still called exactly once on the success path', async () => {
    mockRosterStart.mockImplementationOnce(() => () => {});

    // Force the meeting to exit quickly via max_meeting_time so the success
    // path (return path, not the catch path) is exercised.
    const result = await joinMeeting('https://teams.microsoft.com/l/meetup-join/ok', { name: 'Verdant Bot' }, {
      meetingDbId: 'meeting-teams-bridge-stop-ok',
      maxMeetingMs: 1,
    });

    expect(result.success).toBe(true);
    expect(mockStop).toHaveBeenCalledTimes(1);
  });
});
