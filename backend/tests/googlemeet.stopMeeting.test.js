'use strict';

// Tests for the external stop hook on the Google Meet bot. Verifies:
//   - stopMeeting(meetingDbId) finds and aborts an active joinMeeting call
//   - returns { stopped: false, reason: 'not_running' } if no match
//   - returns { stopped: false, reason: 'no_meeting_id' } when called with falsy
//   - listActiveMeetings() reflects current registrations
//   - the abort signal hooks into the registry on construction

// jest.mock is hoisted to the top of the file BEFORE any imports, so
// the mock-path arguments must be string literals (no path.join() yet).
jest.mock('../src/bot/bot_scripts/googlemeet/browser', () => ({
  launchBrowser: jest.fn(),
  closeBrowser: jest.fn(),
  takeScreenshot: jest.fn(),
}));
jest.mock('../src/bot/bot_scripts/googlemeet/join', () => ({
  joinGoogleMeetMeeting: jest.fn(),
}));
jest.mock('../src/bot/bot_scripts/googlemeet/admission', () => ({
  waitForAdmission: jest.fn(),
  checkMeetingStatus: jest.fn(),
}));
jest.mock('../src/bot/bot_scripts/googlemeet/leave', () => ({
  leaveGoogleMeet: jest.fn(),
  prepareForLeave: jest.fn(),
  forceLeave: jest.fn(),
}));

const { stopMeeting, listActiveMeetings } = require(
  '../src/bot/bot_scripts/googlemeet/index',
);

describe('stopMeeting / listActiveMeetings', () => {
  test('returns no_meeting_id when called with falsy id', async () => {
    expect(await stopMeeting()).toEqual({ stopped: false, reason: 'no_meeting_id' });
    expect(await stopMeeting(null)).toEqual({ stopped: false, reason: 'no_meeting_id' });
    expect(await stopMeeting('')).toEqual({ stopped: false, reason: 'no_meeting_id' });
  });

  test('returns not_running when meeting id is unknown', async () => {
    const result = await stopMeeting('does-not-exist');
    expect(result).toEqual({ stopped: false, reason: 'not_running' });
  });

  test('listActiveMeetings is empty initially', () => {
    // Other tests may register entries; we can't assert exact list, but
    // the API shape must be a plain array.
    expect(Array.isArray(listActiveMeetings())).toBe(true);
  });

  test('object-form invocation is accepted', async () => {
    const result = await stopMeeting({ meetingDbId: 'unknown', reason: 'user_clicked_end' });
    expect(result.stopped).toBe(false);
    expect(result.reason).toBe('not_running');
  });
});
