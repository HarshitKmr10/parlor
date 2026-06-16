'use strict';

// Prisma-backed implementation of the MeetingJoinerStore interface (see
// types.js). Loaded when MEETING_JOINER_DB_DRIVER=prisma (the default,
// preserving monorepo behaviour). Wraps the existing Prisma client paths
// that meetingJoinerService.js used to call directly.

const path = require('node:path');
const { assertStatus } = require('./statusEnum');

// PrismaClient is resolved at the prior monorepo path. If the path
// doesn't exist (standalone repo with the prisma adapter selected by
// accident), we throw a clear error pointing the user at the pg
// adapter instead of letting the require crash with a cryptic message.
function loadPrismaClient() {
  try {
    const { PrismaClient } = require(
      path.resolve(__dirname, '..', '..', '..', '..', 'core', 'core', 'db', 'node_modules', '@prisma', 'client')
    );
    return PrismaClient;
  } catch (err) {
    throw new Error(
      'MEETING_JOINER_DB_DRIVER=prisma but the Prisma client could not be loaded ' +
      'from ../../core/core/db/node_modules/@prisma/client. ' +
      'In a standalone deployment, set MEETING_JOINER_DB_DRIVER=pg instead.\n' +
      `Underlying error: ${err.message}`
    );
  }
}

let prisma = null;
function getPrisma() {
  if (prisma) return prisma;
  const PrismaClient = loadPrismaClient();
  prisma = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL } },
    log: ['error', 'warn'],
  });
  return prisma;
}

async function findExistingOngoing(normalizedUrl, orgId = null) {
  const where = {
    normalized_meeting_url: normalizedUrl,
    status: 'ongoing',
    is_duplicate: false,
  };
  if (orgId) where.org_id = orgId;
  return getPrisma().meeting_joiner.findFirst({
    where,
    orderBy: { bot_join_time: 'desc' },
  });
}

async function createMeetingJoiner(data) {
  if (data.status) assertStatus(data.status);
  return getPrisma().meeting_joiner.create({ data });
}

async function findUniqueWithRelations(id) {
  return getPrisma().meeting_joiner.findUnique({
    where: { id },
    include: { org: true, meeting: true, original_meeting: true, duplicates: true },
  });
}

async function findUniqueBasic(id) {
  return getPrisma().meeting_joiner.findUnique({ where: { id } });
}

async function findManyByOrg(orgId, status = null) {
  const where = { org_id: orgId };
  if (status) {
    assertStatus(status);
    where.status = status;
  }
  return getPrisma().meeting_joiner.findMany({
    where,
    orderBy: { created_at: 'desc' },
    include: { org: true, meeting: true },
  });
}

async function findActive() {
  return getPrisma().meeting_joiner.findMany({
    where: { status: 'ongoing' },
    include: { org: true, meeting: true },
  });
}

async function findActiveDuplicatesOf(originalId) {
  return getPrisma().meeting_joiner.findMany({
    where: { original_meeting_id: originalId, is_duplicate: true, status: 'ongoing' },
  });
}

async function updateStatusAndTimestamps(id, status, extras = {}) {
  assertStatus(status);
  const data = { status, updated_at: new Date(), ...extras };
  if (status === 'ongoing' && !('bot_join_time' in extras)) {
    data.bot_join_time = new Date();
  } else if (status === 'completed' && !('bot_leave_time' in extras)) {
    data.bot_leave_time = new Date();
  }
  return getPrisma().meeting_joiner.update({ where: { id }, data });
}

async function updateFields(id, fields) {
  if (fields.status) assertStatus(fields.status);
  return getPrisma().meeting_joiner.update({
    where: { id },
    data: { ...fields, updated_at: new Date() },
  });
}

async function updateTranscript(id, transcript) {
  return getPrisma().meeting_joiner.update({
    where: { id },
    data: { transcript, updated_at: new Date() },
  });
}

async function updateParticipants(id, participants) {
  return getPrisma().meeting_joiner.update({
    where: { id },
    data: { participants, updated_at: new Date() },
  });
}

async function updateManyDuplicateParticipants(originalId, participants) {
  await getPrisma().meeting_joiner.updateMany({
    where: { original_meeting_id: originalId, is_duplicate: true, status: 'ongoing' },
    data: { participants, updated_at: new Date() },
  });
}

async function setVideoLink(id, link) {
  return getPrisma().meeting_joiner.update({
    where: { id },
    data: { video_link: link, updated_at: new Date() },
  });
}

async function disconnect() {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
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
  updateParticipants,
  updateManyDuplicateParticipants,
  setVideoLink,
  disconnect,
};
