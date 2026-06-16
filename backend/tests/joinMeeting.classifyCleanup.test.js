'use strict';

// Regression tests for the cleanup-output filter that fronts the
// end-of-meeting LLM cleanup append loop. The bug we caught on staging
// (meeting 6132490a-...) was 252 trailing transcript rows labelled
// "Unknown" with startTime=endTime=0, all generated when the LLM was
// fed AssemblyAI partials and re-emitted them with no speaker. These
// tests pin the skip rules so future cleanup-prompt tweaks can't
// silently re-introduce the regression.

const path = require('node:path');
const { classifyCleanupOutput } = require(path.join('..', 'src', 'bot', 'bot_scripts', 'msteams', 'joinMeeting'));

describe('classifyCleanupOutput', () => {
  test('appends real-name segment with timing', () => {
    const verdict = classifyCleanupOutput({
      speaker: 'Harshit Kumar', text: 'hi', start_ms: 1_000, end_ms: 2_000, reason: 'keep',
    });
    expect(verdict.decision).toBe('append');
    expect(verdict.speaker).toBe('Harshit Kumar');
    expect(verdict.startMs).toBe(1_000);
    expect(verdict.endMs).toBe(2_000);
  });

  test.each([
    ['empty', ''],
    ['whitespace', '   '],
    ['undefined', undefined],
    ['Unknown', 'Unknown'],
    ['Unknown speaker', 'Unknown speaker'],
    ['Speaker 0', 'Speaker 0'],
    ['Speaker 12', 'Speaker 12'],
    ['lowercase speaker n', 'speaker 3'],
  ])('skips junk attribution (%s)', (_label, speaker) => {
    const verdict = classifyCleanupOutput({ speaker, text: 'x', start_ms: 1, end_ms: 2 });
    expect(verdict.decision).toBe('skip_junk_attribution');
  });

  test('skips when both timings are zero (partial leak)', () => {
    const verdict = classifyCleanupOutput({ speaker: 'Alice', text: 'hi', start_ms: 0, end_ms: 0 });
    expect(verdict.decision).toBe('skip_no_timing');
  });

  test('skips when timing is non-finite', () => {
    expect(classifyCleanupOutput({ speaker: 'Alice', text: 'x', start_ms: NaN, end_ms: 1 }).decision)
      .toBe('skip_no_timing');
    expect(classifyCleanupOutput({ speaker: 'Alice', text: 'x', start_ms: 1 }).decision)
      .toBe('skip_no_timing');
  });

  test('skips null input', () => {
    expect(classifyCleanupOutput(null).decision).toBe('skip_junk_attribution');
    expect(classifyCleanupOutput(undefined).decision).toBe('skip_junk_attribution');
  });

  test('appends 0-start with non-zero end (allowed: utterance from t=0)', () => {
    const verdict = classifyCleanupOutput({ speaker: 'Bob', text: 'hi', start_ms: 0, end_ms: 500 });
    expect(verdict.decision).toBe('append');
  });

  test('regression: the staging meeting cleanup output shape is rejected', () => {
    // This is the exact shape persisted as cleanup_3 in meeting
    // 6132490a-... — speaker null/undefined (defaulted to 'Unknown' at
    // the call site), start_ms/end_ms either missing or 0. Any future
    // change that lets this through is the bug we're fixing.
    const stagingShape = { text: 'So we will', reason: 'keep' };
    expect(classifyCleanupOutput(stagingShape).decision).toBe('skip_junk_attribution');
  });
});
