#!/usr/bin/env node
// Env-key drift guard.
//
// Compares the LHS (key names) of:
//   - meeting-joiner/.env.example        (the bundle's documented contract)
//   - infra/envs/staging/meeting-joiner-env  (monorepo source of truth)
//
// Fails CI on any drift so the standalone bundle never silently rots
// when someone adds a new env key in the monorepo deploy spec. Values
// are never read — this is a key-set check only, no secrets cross.
//
// Sibling to db/extract-bootstrap.mjs.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const BUNDLE_TEMPLATE = path.join(__dirname, '..', '.env.example');
const MONOREPO_ENV = path.join(REPO_ROOT, 'infra', 'envs', 'staging', 'meeting-joiner-env');

function readKeys(filePath, { includeCommented = false } = {}) {
  if (!fs.existsSync(filePath)) return null;
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  const keys = new Set();
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    let probe = line;
    if (line.startsWith('#')) {
      if (!includeCommented) continue;
      // Treat `# KEY=...` as a documented-but-defaulted key.
      probe = line.replace(/^#+\s*/, '');
    }
    const m = probe.match(/^([A-Z][A-Z0-9_]*)\s*=/);
    if (m) keys.add(m[1]);
  }
  return keys;
}

// Monorepo file mixes active (KEY=val) and documented-default (# KEY=val) lines.
// We treat both as part of the spec — the bundle template should cover the union.
const monorepo = readKeys(MONOREPO_ENV, { includeCommented: true });
const bundle = readKeys(BUNDLE_TEMPLATE);

if (!bundle) {
  process.stderr.write(`❌ meeting-joiner/.env.example not found at ${BUNDLE_TEMPLATE}\n`);
  process.exit(1);
}

if (!monorepo) {
  // Standalone repo (no monorepo neighbour). Nothing to diff against.
  process.stdout.write('⚠️  infra/envs/staging/meeting-joiner-env not found; drift check skipped (standalone repo).\n');
  process.exit(0);
}

// Some keys live ONLY in the bundle (e.g. MEETING_JOINER_DB_DRIVER) and
// shouldn't trip the drift check just because the monorepo env file
// hasn't been updated to reference them yet.
const BUNDLE_ONLY_ALLOWLIST = new Set([
  'MEETING_JOINER_DB_DRIVER',
  'MEETING_JOINER_PG_MAX',
  'MEETING_JOINER_BOOTSTRAP_ON_START',
]);

// One-way drift: every key documented in the monorepo spec MUST exist in
// the bundle template. The bundle is allowed to over-document (e.g. keys
// the monorepo doesn't enable yet) — that's safer for vendor consumers.
const missingFromBundle = [...monorepo].filter((k) => !bundle.has(k)).sort();

function fail(message, lines) {
  process.stderr.write(`\n❌ env-key drift: ${message}\n\n${lines.map((l) => '  ' + l).join('\n')}\n\n`);
  process.stderr.write('Reconcile by editing meeting-joiner/.env.example to add the missing key(s).\n');
  process.exit(1);
}

if (missingFromBundle.length) {
  fail(
    `${missingFromBundle.length} key(s) present in infra/envs/staging/meeting-joiner-env but missing from .env.example`,
    missingFromBundle,
  );
}

// Secret-shape guard — ensure no realistic-looking value leaked into the
// bundle template. Real secrets are usually long opaque strings; the
// template uses <PLACEHOLDER> or short defaults. Refuse to pass if any
// value looks like an actual credential.
const SUSPICIOUS = [];
for (const raw of fs.readFileSync(BUNDLE_TEMPLATE, 'utf8').split('\n')) {
  const line = raw.trim();
  if (!line || line.startsWith('#')) continue;
  const m = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
  if (!m) continue;
  const [, key, rawVal] = m;
  const val = rawVal.replace(/^['"]|['"]$/g, '').trim();
  if (!val) continue;
  if (val.startsWith('<') && val.endsWith('>')) continue; // placeholder
  // 32+ chars of non-whitespace usually means a real key or token. Skip
  // common false positives: model identifiers (contain '.' or '-'), tuning
  // env vars under MSTEAMS_/TRANSCRIPT_, and *_MODEL/*_MODEL_ID names.
  const looksLikeIdentifier = /[.\-:]/.test(val) || val.includes('/');
  const tuningKey = key.startsWith('MSTEAMS_') || key.startsWith('TRANSCRIPT_');
  const modelKey = /_MODEL(_ID)?$/.test(key);
  if (/^\S{32,}$/.test(val) && !looksLikeIdentifier && !tuningKey && !modelKey) {
    SUSPICIOUS.push(`${key} looks like a real value (len=${val.length})`);
  }
}
if (SUSPICIOUS.length) {
  process.stderr.write('\n❌ env-template safety: suspected real secrets in .env.example:\n');
  for (const s of SUSPICIOUS) process.stderr.write(`  ${s}\n`);
  process.stderr.write('\nReplace these values with <REQUIRED>/<OPTIONAL> placeholders.\n');
  process.exit(1);
}

process.stdout.write(`✅ env-key drift check passed (${bundle.size} keys in bundle, ${monorepo.size} in monorepo)\n`);
