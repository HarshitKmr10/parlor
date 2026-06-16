'use strict';

// Prisma's `meeting_joiner_status` enum was the type-system enforcement
// point for valid status values. Raw SQL inserts bypass that — the
// Postgres ENUM constraint still rejects bad values, but the error
// surface is much later (DB roundtrip + cryptic error). This validator
// fails fast at the application boundary with a clear message.

const STATUSES = Object.freeze(['not_joined', 'joining', 'ongoing', 'interrupted', 'completed', 'failed']);

function isStatus(value) {
  return typeof value === 'string' && STATUSES.includes(value);
}

function assertStatus(value) {
  if (!isStatus(value)) {
    throw new Error(
      `invalid meeting_joiner status: ${JSON.stringify(value)}; ` +
      `expected one of ${STATUSES.join(', ')}`
    );
  }
  return value;
}

module.exports = { STATUSES, isStatus, assertStatus };
