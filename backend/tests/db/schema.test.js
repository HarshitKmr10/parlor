'use strict';

const ORIGINAL_SCHEMA = process.env.MEETING_JOINER_SCHEMA;
const ORIGINAL_PGQUEUER_SCHEMA = process.env.MEETING_JOINER_PGQUEUER_SCHEMA;

function restoreEnv() {
  if (ORIGINAL_SCHEMA === undefined) delete process.env.MEETING_JOINER_SCHEMA;
  else process.env.MEETING_JOINER_SCHEMA = ORIGINAL_SCHEMA;

  if (ORIGINAL_PGQUEUER_SCHEMA === undefined) delete process.env.MEETING_JOINER_PGQUEUER_SCHEMA;
  else process.env.MEETING_JOINER_PGQUEUER_SCHEMA = ORIGINAL_PGQUEUER_SCHEMA;
}

afterEach(() => {
  restoreEnv();
  jest.resetModules();
});

describe('schema helpers', () => {
  test('defaults to public and pgqueuer', () => {
    delete process.env.MEETING_JOINER_SCHEMA;
    delete process.env.MEETING_JOINER_PGQUEUER_SCHEMA;
    jest.resetModules();

    const schema = require('../../src/db/js/schema');

    expect(schema.meetingJoinerSchema()).toBe('public');
    expect(schema.pgqueuerSchema()).toBe('pgqueuer');
    expect(schema.qualifiedName('meeting_joiner')).toBe('"public"."meeting_joiner"');
  });

  test('uses configured lowercase schemas', () => {
    process.env.MEETING_JOINER_SCHEMA = 'meeting_joiner';
    process.env.MEETING_JOINER_PGQUEUER_SCHEMA = 'meeting_joiner_pgqueuer';
    jest.resetModules();

    const schema = require('../../src/db/js/schema');

    expect(schema.meetingJoinerSchema()).toBe('meeting_joiner');
    expect(schema.pgqueuerSchema()).toBe('meeting_joiner_pgqueuer');
    expect(schema.qualifiedName('meeting_joiner')).toBe('"meeting_joiner"."meeting_joiner"');
  });

  test('rejects unsafe schema names', () => {
    process.env.MEETING_JOINER_SCHEMA = 'public;drop schema public';
    jest.resetModules();

    const schema = require('../../src/db/js/schema');

    expect(() => schema.meetingJoinerSchema()).toThrow(/MEETING_JOINER_SCHEMA/);
  });
});
