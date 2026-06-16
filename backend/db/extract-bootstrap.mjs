#!/usr/bin/env node
// Drift checker: asserts that the bundled bootstrap.sql stays in sync with
// the canonical Prisma schema at core/core/db/prisma/schema.prisma.
//
// Compares three things:
//   1. The meeting_joiner_status enum values.
//   2. Every column on the `model meeting_joiner` block.
//   3. Every @@index() declared on the same model.
//
// Exits 0 on parity, 1 on drift with a human-readable diff. Wired into CI
// alongside extract-env-example.mjs.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const PRISMA_SCHEMA = path.join(REPO_ROOT, 'core', 'core', 'db', 'prisma', 'schema.prisma');
const BOOTSTRAP_SQL = path.join(__dirname, 'bootstrap.sql');

function fail(message, details) {
  process.stderr.write(`\n❌ schema drift detected: ${message}\n`);
  if (details) process.stderr.write(`\n${details}\n`);
  process.stderr.write(`\nReconcile by editing meeting-joiner/db/bootstrap.sql to match the Prisma source of truth.\n`);
  process.exit(1);
}

function ok(message) {
  process.stdout.write(`✅ ${message}\n`);
}

// ── load files ──────────────────────────────────────────────────────────
if (!fs.existsSync(PRISMA_SCHEMA)) {
  // Standalone repo with no monorepo schema — drift check is a no-op.
  process.stdout.write('⚠️  schema.prisma not found at expected path; drift check skipped (standalone repo).\n');
  process.exit(0);
}

const prisma = fs.readFileSync(PRISMA_SCHEMA, 'utf8');
const sql = fs.readFileSync(BOOTSTRAP_SQL, 'utf8');

// ── parse Prisma enum ───────────────────────────────────────────────────
function parsePrismaEnum(src, enumName) {
  const re = new RegExp(`enum\\s+${enumName}\\s*\\{([^}]*)\\}`, 'm');
  const match = src.match(re);
  if (!match) fail(`enum ${enumName} not found in schema.prisma`);
  return match[1]
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, '').trim())
    .filter(Boolean);
}

// ── parse Prisma model block ────────────────────────────────────────────
function parsePrismaModel(src, modelName) {
  // Walk character-by-character to support nested braces (block annotations).
  const startRe = new RegExp(`model\\s+${modelName}\\s*\\{`, 'm');
  const startMatch = src.match(startRe);
  if (!startMatch) fail(`model ${modelName} not found in schema.prisma`);
  let depth = 1;
  let i = startMatch.index + startMatch[0].length;
  const start = i;
  while (i < src.length && depth > 0) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') depth -= 1;
    i += 1;
  }
  return src.slice(start, i - 1);
}

function parsePrismaModelNames(src) {
  return new Set(
    [...src.matchAll(/^model\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/gm)].map(
      (match) => match[1],
    ),
  );
}

function normalisePrismaFieldType(typeName) {
  return typeName.replace(/\?$/, '').replace(/\[\]$/, '');
}

function parsePrismaColumns(body, modelNames) {
  // Physical columns are scalar or enum fields. Relation fields point at
  // another Prisma model and may or may not carry @relation; list backrefs like
  // `sessions meeting_sessions[]` do not, so use model names as the source of
  // truth for excluding relations.
  const cols = [];
  for (const raw of body.split('\n')) {
    const line = raw.replace(/\/\/.*$/, '').trim();
    if (!line) continue;
    if (line.startsWith('@@')) continue;
    if (!/^[a-z_][a-z0-9_]*\s/i.test(line)) continue;
    if (/@relation\b/.test(line)) continue;
    const [name, typeName] = line.split(/\s+/);
    if (!typeName) continue;
    if (modelNames.has(normalisePrismaFieldType(typeName))) continue;
    cols.push(name);
  }
  return cols;
}

function parsePrismaIndexes(body) {
  const idx = [];
  for (const line of body.split('\n')) {
    const m = line.match(/@@index\(\[([^\]]+)\]\)/);
    if (m) idx.push(m[1].split(',').map((s) => s.trim()).join(','));
  }
  return idx;
}

// ── parse bootstrap.sql ─────────────────────────────────────────────────
function parseSqlEnum(src, enumName) {
  const re = new RegExp(`CREATE TYPE ${enumName} AS ENUM \\(([^)]+)\\)`, 'i');
  const m = src.match(re);
  if (!m) fail(`enum ${enumName} not declared in bootstrap.sql`);
  return m[1]
    .split(',')
    .map((s) => s.trim().replace(/^['"]|['"]$/g, ''));
}

function parseSqlColumns(src, tableName) {
  const re = new RegExp(`CREATE TABLE IF NOT EXISTS ${tableName}\\s*\\(([\\s\\S]*?)\\n\\)`, 'i');
  const m = src.match(re);
  if (!m) fail(`table ${tableName} not declared in bootstrap.sql`);
  const body = m[1];
  const cols = [];
  for (const raw of body.split('\n')) {
    const line = raw.replace(/--.*$/, '').trim().replace(/,$/, '');
    if (!line) continue;
    if (/^(PRIMARY KEY|CONSTRAINT|FOREIGN KEY|UNIQUE|CHECK)/i.test(line)) continue;
    const name = line.split(/\s+/)[0].toLowerCase();
    if (/^[a-z_]+$/.test(name)) cols.push(name);
  }
  return cols;
}

function parseSqlIndexes(src, tableName) {
  const re = new RegExp(`CREATE INDEX IF NOT EXISTS\\s+\\S+\\s+ON ${tableName}\\s*\\(([^)]+)\\)`, 'gi');
  const out = [];
  let m;
  while ((m = re.exec(src)) !== null) {
    out.push(m[1].split(',').map((s) => s.trim()).join(','));
  }
  return out;
}

// ── diff helpers ────────────────────────────────────────────────────────
function diff(a, b) {
  const missing = a.filter((x) => !b.includes(x));
  const extra = b.filter((x) => !a.includes(x));
  return { missing, extra };
}

// ── run ─────────────────────────────────────────────────────────────────
const enumExpected = parsePrismaEnum(prisma, 'meeting_joiner_status');
const enumActual = parseSqlEnum(sql, 'meeting_joiner_status');
const enumDiff = diff(enumExpected, enumActual);
if (enumDiff.missing.length || enumDiff.extra.length) {
  fail('meeting_joiner_status enum mismatch',
    `  missing from bootstrap.sql: ${enumDiff.missing.join(', ') || '(none)'}\n` +
    `  extra in bootstrap.sql:     ${enumDiff.extra.join(', ') || '(none)'}`);
}
ok(`enum meeting_joiner_status — ${enumActual.length} values match`);

const modelBody = parsePrismaModel(prisma, 'meeting_joiner');
const colsExpected = parsePrismaColumns(modelBody, parsePrismaModelNames(prisma));
const colsActual = parseSqlColumns(sql, 'meeting_joiner');
const colsDiff = diff(colsExpected, colsActual);
if (colsDiff.missing.length || colsDiff.extra.length) {
  fail('meeting_joiner columns mismatch',
    `  missing from bootstrap.sql: ${colsDiff.missing.join(', ') || '(none)'}\n` +
    `  extra in bootstrap.sql:     ${colsDiff.extra.join(', ') || '(none)'}`);
}
ok(`table meeting_joiner — ${colsActual.length} columns match`);

const idxExpected = parsePrismaIndexes(modelBody);
const idxActual = parseSqlIndexes(sql, 'meeting_joiner');
const idxDiff = diff(idxExpected, idxActual);
if (idxDiff.missing.length || idxDiff.extra.length) {
  fail('meeting_joiner indexes mismatch',
    `  missing from bootstrap.sql: ${idxDiff.missing.join(', ') || '(none)'}\n` +
    `  extra in bootstrap.sql:     ${idxDiff.extra.join(', ') || '(none)'}`);
}
ok(`indexes — ${idxActual.length} match`);

process.stdout.write('\n✅ schema bootstrap is in sync with Prisma source of truth.\n');
