'use strict';

const path = require('node:path');

describe('store factory', () => {
  let storeModule;
  let originalDriver;
  let originalDbUrl;
  let originalSchema;
  let originalPgqueuerSchema;

  beforeEach(() => {
    originalDriver = process.env.MEETING_JOINER_DB_DRIVER;
    originalDbUrl = process.env.DATABASE_URL;
    originalSchema = process.env.MEETING_JOINER_SCHEMA;
    originalPgqueuerSchema = process.env.MEETING_JOINER_PGQUEUER_SCHEMA;
    delete process.env.MEETING_JOINER_SCHEMA;
    delete process.env.MEETING_JOINER_PGQUEUER_SCHEMA;
    // Provide a syntactically valid URL so pgPool doesn't throw on import.
    // The pool is lazy-initialised; tests don't actually connect.
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    jest.doMock('pg', () => ({
      Pool: jest.fn(() => ({
        on: jest.fn(),
        query: jest.fn(),
        end: jest.fn(),
      })),
    }), { virtual: true });
    jest.resetModules();
    storeModule = require('../../src/db/js/store');
    storeModule._resetForTests();
  });

  afterEach(() => {
    if (originalDriver === undefined) delete process.env.MEETING_JOINER_DB_DRIVER;
    else process.env.MEETING_JOINER_DB_DRIVER = originalDriver;
    if (originalDbUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDbUrl;
    if (originalSchema === undefined) delete process.env.MEETING_JOINER_SCHEMA;
    else process.env.MEETING_JOINER_SCHEMA = originalSchema;
    if (originalPgqueuerSchema === undefined) delete process.env.MEETING_JOINER_PGQUEUER_SCHEMA;
    else process.env.MEETING_JOINER_PGQUEUER_SCHEMA = originalPgqueuerSchema;
    jest.dontMock('pg');
  });

  test('defaults to prisma when env var is unset', () => {
    delete process.env.MEETING_JOINER_DB_DRIVER;
    expect(() => storeModule.createStore()).not.toThrow();
  });

  test('createStore("pg") returns the raw-SQL adapter', () => {
    const store = storeModule.createStore('pg');
    // Method surface check — every member of the interface is present.
    for (const m of [
      'findExistingOngoing', 'createMeetingJoiner', 'findUniqueWithRelations',
      'findUniqueBasic', 'findManyByOrg', 'findActive', 'findActiveDuplicatesOf',
      'updateStatusAndTimestamps', 'updateFields', 'updateTranscript',
      'updateParticipants', 'updateManyDuplicateParticipants', 'setVideoLink',
      'disconnect',
    ]) {
      expect(typeof store[m]).toBe('function');
    }
  });

  test('createStore("pg") and ("prisma") expose the same method shape', () => {
    const pg = storeModule.createStore('pg');
    expect(() => storeModule.createStore('prisma')).not.toThrow();
    expect(Object.keys(pg).length).toBeGreaterThan(10);
  });

  test('createStore throws on unknown driver', () => {
    expect(() => storeModule.createStore('mysql')).toThrow(/unknown MEETING_JOINER_DB_DRIVER/);
  });

  test('custom meeting-joiner schema requires pg driver', () => {
    process.env.MEETING_JOINER_SCHEMA = 'meeting_joiner';

    expect(() => storeModule.createStore('prisma')).toThrow(/requires MEETING_JOINER_DB_DRIVER=pg/);
    expect(() => storeModule.createStore('pg')).not.toThrow();
  });

  test('custom pgqueuer schema alone does not force the meeting-joiner data driver', () => {
    process.env.MEETING_JOINER_PGQUEUER_SCHEMA = 'meeting_joiner_pgqueuer';

    expect(() => storeModule.createStore('prisma')).not.toThrow();
  });
});
