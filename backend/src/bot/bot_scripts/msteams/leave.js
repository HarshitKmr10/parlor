'use strict';

const { clickAny, sleep } = require('./dom');

const HANGUP_SELECTORS = [
  'button[data-tid="hangup-main-btn"]',
  'button[aria-label*="Leave" i]',
  'button:has-text("Leave")',
];

const CONFIRM_SELECTORS = [
  'button[data-tid="hangup-leave-button"]',
  'button:has-text("Leave meeting")',
  'button:has-text("Leave")',
];

async function leaveMeeting(page, { logger } = {}) {
  const log = logger || console;
  const clickedHangup = await clickAny(page, HANGUP_SELECTORS, { timeoutMs: 1_500 });
  if (!clickedHangup) {
    log.info?.('[teams.leave] hangup button not visible, closing page');
    return { method: 'closed' };
  }
  // Some Teams flows present a "Leave or end" confirmation — try both targets.
  const clickedConfirm = await clickAny(page, CONFIRM_SELECTORS, { timeoutMs: 1_000 });
  await sleep(300);
  return { method: clickedConfirm ? 'confirmed' : 'hangup_only' };
}

module.exports = { leaveMeeting };
