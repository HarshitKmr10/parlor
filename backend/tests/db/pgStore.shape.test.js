'use strict';

// Unit tests on pgStore that don't need a real Postgres — we verify the
// shape of the SQL strings and the column/writable-field whitelist. The
// parity-with-prisma integration test is a separate CI job that spins up
// a Postgres container.

jest.mock('pg', () => ({
  Pool: jest.fn(() => ({
    on: jest.fn(),
    query: jest.fn(),
    end: jest.fn(),
  })),
}), { virtual: true });

const originalDbUrl = process.env.DATABASE_URL;
const originalSchema = process.env.MEETING_JOINER_SCHEMA;
beforeAll(() => {
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
  delete process.env.MEETING_JOINER_SCHEMA;
});
afterAll(() => {
  if (originalDbUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDbUrl;
  if (originalSchema === undefined) delete process.env.MEETING_JOINER_SCHEMA;
  else process.env.MEETING_JOINER_SCHEMA = originalSchema;
});

const pgStore = require('../../src/db/js/pgStore');

describe('pgStore column whitelist', () => {
  test('exposes the 20-column projection in stable order', () => {
    expect(pgStore._columns).toEqual([
      'id', 'meeting_url', 'normalized_meeting_url', 'status', 'video_link',
      'transcript', 'participants', 'org_id', 'meeting_id',
      'bot_join_time', 'bot_leave_time', 'bot_name', 'transcript_source',
      'exit_reason', 'exit_details', 'process_id', 'original_meeting_id',
      'is_duplicate', 'created_at', 'updated_at',
    ]);
  });

  test('writable fields exclude auto-managed timestamps and primary key', () => {
    expect(pgStore._writableFields.has('id')).toBe(false);
    expect(pgStore._writableFields.has('created_at')).toBe(false);
    expect(pgStore._writableFields.has('updated_at')).toBe(false);
    expect(pgStore._writableFields.has('status')).toBe(true);
    expect(pgStore._writableFields.has('exit_reason')).toBe(true);
    expect(pgStore._writableFields.has('exit_details')).toBe(true);
  });

  test('exposes every required Store method', () => {
    const required = [
      'findExistingOngoing', 'createMeetingJoiner', 'findUniqueWithRelations',
      'findUniqueBasic', 'findManyByOrg', 'findActive', 'findActiveDuplicatesOf',
      'updateStatusAndTimestamps', 'updateFields', 'updateTranscript',
      'updateParticipants', 'updateManyDuplicateParticipants', 'setVideoLink',
      'disconnect',
    ];
    for (const m of required) expect(typeof pgStore[m]).toBe('function');
  });

  test('uses public meeting_joiner table by default', () => {
    expect(pgStore._meetingJoinerTable).toBe('"public"."meeting_joiner"');
  });
});
