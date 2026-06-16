'use strict';

// Raw-SQL implementation of the MeetingJoinerStore interface (see types.js).
// Loaded only when MEETING_JOINER_DB_DRIVER=pg. Uses the shared pool from
// pgPool.js; all queries are parameterized to avoid SQL injection.
//
// Behaviour parity with prismaStore.js is verified by the parametrized
// adapter test suite at tests/db/jsAdapter.parity.test.js.

const { getPool, closePool } = require('./pgPool');
const { qualifiedName } = require('./schema');
const { assertStatus } = require('./statusEnum');

const MEETING_JOINER_TABLE = qualifiedName('meeting_joiner');
const ORGANIZATIONS_TABLE = qualifiedName('organizations');
const MEETINGS_TABLE = qualifiedName('meetings');

// Single source of truth for column order — used by SELECT projections
// and by camelCase row hydration. Keep in sync with bootstrap.sql.
//
// process_id was removed in the pod-per-meeting refactor; pod_name +
// cluster_name + last_heartbeat_at replace it. Older standalone DBs that
// still have process_id are handled transparently by the bootstrap's
// idempotent ALTER (DROP COLUMN IF EXISTS).
const COLUMNS = Object.freeze([
  'id', 'meeting_url', 'normalized_meeting_url', 'status', 'video_link',
  'transcript', 'participants', 'org_id', 'meeting_id',
  'bot_join_time', 'bot_leave_time', 'bot_name', 'transcript_source',
  'exit_reason', 'exit_details', 'pod_name', 'cluster_name',
  'last_heartbeat_at', 'original_meeting_id',
  'is_duplicate', 'created_at', 'updated_at',
]);

const SELECT_ALL = COLUMNS.join(', ');

// Columns the application can write through updateFields. Mirrors the
// Prisma model surface minus auto-managed timestamps.
const WRITABLE_FIELDS = new Set([
  'meeting_url', 'normalized_meeting_url', 'status', 'video_link',
  'transcript', 'participants', 'org_id', 'meeting_id',
  'bot_join_time', 'bot_leave_time', 'bot_name', 'transcript_source',
  'exit_reason', 'exit_details', 'pod_name', 'cluster_name',
  'last_heartbeat_at', 'original_meeting_id',
  'is_duplicate',
]);

// JSON columns need JSON.stringify before going through pg — node-postgres
// accepts plain objects for jsonb but stringifies arrays as Postgres
// arrays, which is wrong here.
const JSON_FIELDS = new Set(['transcript', 'participants', 'exit_details']);

function serialiseValue(field, value) {
  if (value === undefined || value === null) return null;
  if (JSON_FIELDS.has(field)) return JSON.stringify(value);
  return value;
}

async function queryOne(text, params) {
  const { rows } = await getPool().query(text, params);
  return rows[0] || null;
}

async function queryAll(text, params) {
  const { rows } = await getPool().query(text, params);
  return rows;
}

// ── 1. findExistingOngoing ─────────────────────────────────────────────
async function findExistingOngoing(normalizedUrl, orgId = null) {
  const where = ['normalized_meeting_url = $1', "status = 'ongoing'", 'is_duplicate = false'];
  const params = [normalizedUrl];
  if (orgId) {
    where.push(`org_id = $${params.length + 1}`);
    params.push(orgId);
  }
  const sql = `
    SELECT ${SELECT_ALL}
      FROM ${MEETING_JOINER_TABLE}
     WHERE ${where.join(' AND ')}
     ORDER BY bot_join_time DESC NULLS LAST
     LIMIT 1`;
  return queryOne(sql, params);
}

// ── 2. createMeetingJoiner ─────────────────────────────────────────────
async function createMeetingJoiner(data) {
  // Filter to writable columns; silently drop unknowns (e.g. the latent
  // `platform` field that meetingJoinerService.js used to pass — that
  // column doesn't exist in the schema and was already a no-op).
  const cols = [];
  const params = [];
  const placeholders = [];
  for (const [key, value] of Object.entries(data)) {
    if (!WRITABLE_FIELDS.has(key)) continue;
    cols.push(key);
    params.push(serialiseValue(key, value));
    placeholders.push(`$${params.length}`);
  }
  if (cols.length === 0) {
    throw new Error('createMeetingJoiner: no writable columns supplied');
  }
  if (data.status) assertStatus(data.status);

  const sql = `
    INSERT INTO ${MEETING_JOINER_TABLE} (${cols.join(', ')})
    VALUES (${placeholders.join(', ')})
    RETURNING ${SELECT_ALL}`;
  return queryOne(sql, params);
}

// ── 3. findUniqueWithRelations — hand-rolled equivalent of Prisma `include`
async function findUniqueWithRelations(id) {
  const base = await queryOne(
    `SELECT ${SELECT_ALL} FROM ${MEETING_JOINER_TABLE} WHERE id = $1`,
    [id]
  );
  if (!base) return null;

  // Parent org / meeting are only hydrated if those tables exist in the
  // database (standalone consumer repos won't have them).
  const [org, meeting, originalMeeting, duplicates] = await Promise.all([
    base.org_id ? safeLookup(ORGANIZATIONS_TABLE, 'id', base.org_id) : Promise.resolve(null),
    base.meeting_id ? safeLookup(MEETINGS_TABLE, 'meeting_id', base.meeting_id) : Promise.resolve(null),
    base.original_meeting_id
      ? queryOne(`SELECT ${SELECT_ALL} FROM ${MEETING_JOINER_TABLE} WHERE id = $1`, [base.original_meeting_id])
      : Promise.resolve(null),
    queryAll(
      `SELECT ${SELECT_ALL} FROM ${MEETING_JOINER_TABLE} WHERE original_meeting_id = $1`,
      [id]
    ),
  ]);

  return { ...base, org, meeting, original_meeting: originalMeeting, duplicates };
}

async function safeLookup(table, idColumn, idValue) {
  try {
    return await queryOne(`SELECT * FROM ${table} WHERE ${idColumn} = $1`, [idValue]);
  } catch (err) {
    if (/relation .* does not exist/i.test(err.message)) return null;
    throw err;
  }
}

// ── 4. findUniqueBasic ─────────────────────────────────────────────────
async function findUniqueBasic(id) {
  return queryOne(
    `SELECT ${SELECT_ALL} FROM ${MEETING_JOINER_TABLE} WHERE id = $1`,
    [id]
  );
}

// ── 5. findManyByOrg ───────────────────────────────────────────────────
async function findManyByOrg(orgId, status = null) {
  const params = [orgId];
  let sql = `SELECT ${SELECT_ALL} FROM ${MEETING_JOINER_TABLE} WHERE org_id = $1`;
  if (status) {
    assertStatus(status);
    params.push(status);
    sql += ` AND status = $2`;
  }
  sql += ` ORDER BY created_at DESC`;
  return queryAll(sql, params);
}

// ── 6. findActive ──────────────────────────────────────────────────────
async function findActive() {
  return queryAll(
    `SELECT ${SELECT_ALL} FROM ${MEETING_JOINER_TABLE} WHERE status = 'ongoing'`,
    []
  );
}

// ── 7. findActiveDuplicatesOf ──────────────────────────────────────────
async function findActiveDuplicatesOf(originalId) {
  return queryAll(
    `SELECT ${SELECT_ALL}
       FROM ${MEETING_JOINER_TABLE}
      WHERE original_meeting_id = $1
        AND is_duplicate = true
        AND status = 'ongoing'`,
    [originalId]
  );
}

// ── 8. updateStatusAndTimestamps ───────────────────────────────────────
async function updateStatusAndTimestamps(id, status, extras = {}) {
  assertStatus(status);
  const fields = { status, ...extras };
  if (status === 'ongoing' && !('bot_join_time' in extras)) {
    // Stamp the FIRST-join time only. Wrapped in __coalesce so a rejoin
    // (session 2+) does NOT overwrite the original — otherwise duration
    // collapses to just the final session's length.
    fields.bot_join_time = { __coalesce: new Date() };
  } else if (
    (status === 'completed' || status === 'failed') &&
    !('bot_leave_time' in extras)
  ) {
    // Stamp leave time on BOTH terminal states. Previously only `completed`
    // got it, so `failed` meetings ended with a null leave time → null
    // duration in the dashboard and skewed failure metrics.
    fields.bot_leave_time = new Date();
  }
  return updateFields(id, fields);
}

// ── 9. updateFields ────────────────────────────────────────────────────
async function updateFields(id, fields) {
  const sets = [];
  const params = [];
  for (const [key, value] of Object.entries(fields)) {
    if (!WRITABLE_FIELDS.has(key)) continue;
    if (key === 'status') assertStatus(value);
    // `{ __coalesce: v }` → write only if the column is currently NULL
    // (atomic, race-free "set once"). Used for bot_join_time so rejoins
    // don't clobber the first-join timestamp.
    if (value && typeof value === 'object' && '__coalesce' in value) {
      params.push(serialiseValue(key, value.__coalesce));
      sets.push(`${key} = COALESCE(${key}, $${params.length})`);
      continue;
    }
    params.push(serialiseValue(key, value));
    sets.push(`${key} = $${params.length}`);
  }
  if (sets.length === 0) {
    return findUniqueBasic(id);
  }
  sets.push(`updated_at = NOW()`);
  params.push(id);
  const sql = `
    UPDATE ${MEETING_JOINER_TABLE}
       SET ${sets.join(', ')}
     WHERE id = $${params.length}
     RETURNING ${SELECT_ALL}`;
  return queryOne(sql, params);
}

// ── 10. updateTranscript ───────────────────────────────────────────────
async function updateTranscript(id, transcript) {
  return queryOne(
    `UPDATE ${MEETING_JOINER_TABLE}
        SET transcript = $1::json,
            updated_at = NOW()
      WHERE id = $2
      RETURNING ${SELECT_ALL}`,
    [JSON.stringify(transcript), id]
  );
}

// ── 10b. updateTranscriptAtomic ────────────────────────────────────────
// Race-free read-modify-write of the transcript JSON, serialised by a
// row-level lock (SELECT ... FOR UPDATE) inside a single transaction. This
// fixes the lost-update window where a dying pod draining ASR and a freshly
// rejoined pod can both read-modify-write the same row and clobber each
// other's segments. `mutate(currentTranscript)` runs INSIDE the lock and
// returns the new transcript object, or null/undefined to make no change
// (e.g. the segment was a duplicate). A dedicated client is checked out so
// BEGIN/COMMIT pin one connection (safe under transaction-mode pgbouncer).
async function updateTranscriptAtomic(id, mutate) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const sel = await client.query(
      `SELECT transcript FROM ${MEETING_JOINER_TABLE} WHERE id = $1 FOR UPDATE`,
      [id]
    );
    if (sel.rowCount === 0) {
      await client.query('ROLLBACK');
      return null;
    }
    let current = sel.rows[0].transcript;
    if (typeof current === 'string') {
      try { current = JSON.parse(current); } catch { current = null; }
    }
    const next = await mutate(current);
    if (next === null || next === undefined) {
      // No-op (e.g. duplicate segment) — release the lock without a write.
      await client.query('COMMIT');
      return null;
    }
    const upd = await client.query(
      `UPDATE ${MEETING_JOINER_TABLE}
          SET transcript = $1::json, updated_at = NOW()
        WHERE id = $2
        RETURNING ${SELECT_ALL}`,
      [JSON.stringify(next), id]
    );
    await client.query('COMMIT');
    return upd.rows[0] || null;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) { /* ignore */ }
    throw err;
  } finally {
    client.release();
  }
}

// ── 11. updateParticipants ─────────────────────────────────────────────
async function updateParticipants(id, participants) {
  return queryOne(
    `UPDATE ${MEETING_JOINER_TABLE}
        SET participants = $1::json,
            updated_at = NOW()
      WHERE id = $2
      RETURNING ${SELECT_ALL}`,
    [JSON.stringify(participants), id]
  );
}

// ── 12. updateManyDuplicateParticipants ────────────────────────────────
async function updateManyDuplicateParticipants(originalId, participants) {
  await getPool().query(
    `UPDATE ${MEETING_JOINER_TABLE}
        SET participants = $1::json,
            updated_at = NOW()
      WHERE original_meeting_id = $2
        AND is_duplicate = true
        AND status = 'ongoing'`,
    [JSON.stringify(participants), originalId]
  );
}

// ── 13. setVideoLink ───────────────────────────────────────────────────
async function setVideoLink(id, link) {
  return queryOne(
    `UPDATE ${MEETING_JOINER_TABLE}
        SET video_link = $1,
            updated_at = NOW()
      WHERE id = $2
      RETURNING ${SELECT_ALL}`,
    [link, id]
  );
}

// ── 14. disconnect ─────────────────────────────────────────────────────
async function disconnect() {
  await closePool();
}

module.exports = {
  findExistingOngoing,
  createMeetingJoiner,
  findUniqueWithRelations,
  findUniqueBasic,
  findManyByOrg,
  findActive,
  findActiveDuplicatesOf,
  updateStatusAndTimestamps,
  updateFields,
  updateTranscript,
  updateTranscriptAtomic,
  updateParticipants,
  updateManyDuplicateParticipants,
  setVideoLink,
  disconnect,
  _columns: COLUMNS,
  _writableFields: WRITABLE_FIELDS,
  _meetingJoinerTable: MEETING_JOINER_TABLE,
};
