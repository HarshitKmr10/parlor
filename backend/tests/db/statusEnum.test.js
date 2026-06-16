'use strict';

const { STATUSES, isStatus, assertStatus } = require('../../src/db/js/statusEnum');

describe('statusEnum', () => {
  test('STATUSES is the canonical 3-value frozen list', () => {
    expect(STATUSES).toEqual(['not_joined', 'ongoing', 'completed']);
    expect(Object.isFrozen(STATUSES)).toBe(true);
  });

  test('isStatus accepts valid values, rejects everything else', () => {
    for (const s of STATUSES) expect(isStatus(s)).toBe(true);
    for (const bad of ['', 'NOT_JOINED', 'on_going', 'completed ', 1, null, undefined, {}]) {
      expect(isStatus(bad)).toBe(false);
    }
  });

  test('assertStatus throws with a helpful message on invalid values', () => {
    expect(() => assertStatus('on_going')).toThrow(/expected one of not_joined, ongoing, completed/);
    expect(() => assertStatus('on_going')).toThrow(/invalid meeting_joiner status/);
  });

  test('assertStatus returns the value on success', () => {
    expect(assertStatus('ongoing')).toBe('ongoing');
  });
});
