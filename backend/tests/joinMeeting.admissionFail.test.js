'use strict';

// Regression tests for the Teams "never got admitted → mislabeled completed"
// bug. On staging, a 9-meeting burst showed 9/9 `completed` while only 4 bots
// were genuinely admitted (bot_join_time set). The 5 that timed out in the
// lobby threw `admission_timeout`, which the catch handler treated as a
// recoverable subprocess crash — so the orchestrator marked them `completed`
// with no exit_reason instead of `failed`. The Google Meet bot already does
// the right thing (failMeeting on pre-join throw); these tests pin the parity
// fix for Teams so it can't silently regress.

const path = require('node:path');
const {
  classifyExitReason,
  preAdmissionFailReason,
} = require(path.join('..', 'src', 'bot', 'bot_scripts', 'msteams', 'joinMeeting'));

describe('classifyExitReason — admission_timeout is terminal', () => {
  test('admission_timeout is terminal (no pointless rejoin of an un-admitted bot)', () => {
    expect(classifyExitReason('admission_timeout')).toBe('terminal');
  });

  test('removed_before_admission stays terminal', () => {
    expect(classifyExitReason('removed_before_admission')).toBe('terminal');
  });

  test('genuinely recoverable infra crashes stay recoverable', () => {
    expect(classifyExitReason('subprocess_crash')).toBe('recoverable');
    expect(classifyExitReason('pod_evicted')).toBe('recoverable');
  });
});

describe('preAdmissionFailReason', () => {
  test('lobby timeout before admission → fail with admission_timeout', () => {
    expect(preAdmissionFailReason(false, 'admission_timeout')).toBe('admission_timeout');
  });

  test('removed before admission → fail with removed_before_admission', () => {
    expect(preAdmissionFailReason(false, 'removed_before_admission')).toBe('removed_before_admission');
  });

  test('same errors AFTER admission are not pre-admission failures (mid-meeting fault)', () => {
    expect(preAdmissionFailReason(true, 'admission_timeout')).toBeNull();
    expect(preAdmissionFailReason(true, 'removed_before_admission')).toBeNull();
  });

  test('a generic pre-admission crash is left recoverable (re-dispatch path owns it)', () => {
    expect(preAdmissionFailReason(false, 'subprocess_crash')).toBeNull();
    expect(preAdmissionFailReason(false, 'Target page, context or browser has been closed')).toBeNull();
  });

  test('missing/empty reason never forces a fail', () => {
    expect(preAdmissionFailReason(false, undefined)).toBeNull();
    expect(preAdmissionFailReason(false, '')).toBeNull();
  });
});
