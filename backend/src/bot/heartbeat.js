'use strict';

/**
 * Bot heartbeat writer (Node side).
 *
 * The sidecar in the same pod reads the mtime of `/tmp/bot.heartbeat` to
 * decide whether the bot is alive or stuck. Bot code calls
 * `startHeartbeat()` on join and `stopHeartbeat()` on leave so the
 * mtime stays fresh while the bot is in the meeting.
 *
 * Tunables:
 * - `BOT_HEARTBEAT_INTERVAL_MS` (default 5000): how often to touch the file.
 * - `BOT_HEARTBEAT_PATH` (default `/tmp/bot.heartbeat`).
 *
 * Also writes `/tmp/bot-state.json` with a small JSON envelope so the
 * sidecar can derive the meeting state ("joining" vs "in_meeting" etc.)
 * without parsing logs.
 */

const fs = require('node:fs');
const path = require('node:path');

const HEARTBEAT_PATH =
  process.env.BOT_HEARTBEAT_PATH || '/tmp/bot.heartbeat';
const STATE_PATH = process.env.BOT_STATE_PATH || '/tmp/bot-state.json';
const INTERVAL_MS = Number(process.env.BOT_HEARTBEAT_INTERVAL_MS || 5000);

let timer = null;

function touchHeartbeat() {
  const now = Date.now();
  try {
    fs.utimesSync(HEARTBEAT_PATH, now / 1000, now / 1000);
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      try {
        fs.writeFileSync(HEARTBEAT_PATH, '');
      } catch (_writeErr) {
        // Best-effort — heartbeat is observability, never blocks.
      }
    }
  }
}

function writeState(partial) {
  try {
    let prior = {};
    if (fs.existsSync(STATE_PATH)) {
      try {
        prior = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
      } catch (_) {
        prior = {};
      }
    }
    const next = {
      ...prior,
      ...partial,
      updated_at: new Date().toISOString(),
    };
    const tmp = `${STATE_PATH}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(next));
    fs.renameSync(tmp, STATE_PATH);
  } catch (_) {
    // ignore — sidecar will fall back to mtime
  }
}

function startHeartbeat(initialState = {}) {
  if (timer !== null) return;
  writeState({ state: 'joining', ...initialState });
  touchHeartbeat();
  timer = setInterval(touchHeartbeat, INTERVAL_MS);
  if (timer.unref) timer.unref(); // don't block process exit
}

function reportState(partial) {
  writeState(partial);
}

function stopHeartbeat(finalState = {}) {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
  writeState({ state: 'ended', ...finalState });
}

module.exports = {
  startHeartbeat,
  reportState,
  stopHeartbeat,
  HEARTBEAT_PATH,
  STATE_PATH,
};
