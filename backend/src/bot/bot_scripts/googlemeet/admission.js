/**
 * Google Meet Admission Handling
 * Waits for bot to be admitted from waiting room
 */

const selectors = require('./selectors');
const { waitForAnySelector } = require('./join');

// The self "Backgrounds and effects" preview panel carries a [data-participant-id]
// too (its label leads with the "visual_effects" ligature / "Backgrounds and
// effects" text), so the raw tile count is >=1 even in the LOBBY. Excluding this
// phantom lets admission key on >=1 REAL participant tile — a positive admitted
// signal, not merely "a tile exists". Ported from Vexa 6f0f6e9. See
// countRealParticipantTiles().
const EFFECTS_TILE = /visual_effects|backgrounds and effects/i;

/**
 * Count REAL participant tiles, excluding the self effects-panel phantom.
 * A real tile (self once in-call, or any remote) has a human-name label; the
 * effects-panel phantom's label matches EFFECTS_TILE. Presence of >=1 real tile
 * is a positive admitted signal independent of the waiting-room negative guard.
 * @param {Page} page - Playwright page
 * @returns {Promise<number>} - Number of real participant tiles
 */
async function countRealParticipantTiles(page) {
  try {
    const labels = await page.locator('[data-participant-id]').evaluateAll(
      (els) => els.map((e) => e.getAttribute('aria-label') || (e.textContent || '').trim())
    );
    return labels.filter((l) => l && !EFFECTS_TILE.test(l)).length;
  } catch (e) {
    return 0;
  }
}

/**
 * Detect a GENUINE reCAPTCHA challenge (Google bot-detection block), NOT the
 * invisible background reCAPTCHA Enterprise frame that Google loads on EVERY
 * normal join. Matching a mere "/recaptcha/" frame URL false-fires on clean
 * joins (verified live by Vexa 2026-06-12; commit 64d3470 reverted exactly that
 * loose emit). We therefore require a VISIBLE challenge surface: a visible
 * recaptcha iframe (the anchor/challenge widget actually rendered on screen),
 * not just a frame existing in the page.
 * @param {Page} page - Playwright page
 * @returns {Promise<boolean>} - Whether a visible reCAPTCHA challenge is present
 */
async function hasRecaptchaChallenge(page) {
  try {
    // The normal "waiting for the host to admit you" lobby is NEVER a block.
    // Google loads a benign reCAPTCHA-Enterprise anchor frame on that screen,
    // which previously false-fired and made the bot bail before it could be
    // admitted. If we're in the waiting room, keep waiting — full stop.
    if (await isInWaitingRoom(page)) {
      return false;
    }

    // Only the actual interactive CHALLENGE popup counts as a block — the
    // "select all images" bframe. The anchor / invisible Enterprise scoring
    // frame (present on every join + the lobby) must NOT trip this, so we
    // intentionally do NOT match `recaptcha/api2/anchor` or a bare
    // `iframe[src*="recaptcha"]`. We also require a real, sizeable surface
    // (the challenge popup is large; anchor/score frames are ~0x0).
    const challengeSelectors = [
      'iframe[title*="recaptcha challenge" i]',
      'iframe[src*="recaptcha"][src*="bframe"]',
    ];
    for (const sel of challengeSelectors) {
      const frameEl = page.locator(sel).first();
      const visible = await frameEl.isVisible({ timeout: 100 }).catch(() => false);
      if (!visible) continue;
      const box = await frameEl.boundingBox().catch(() => null);
      if (box && box.width >= 100 && box.height >= 100) {
        return true;
      }
    }
    return false;
  } catch (e) {
    return false;
  }
}

/**
 * Check whether the bot is currently BLOCKED by Google bot-detection (a visible
 * reCAPTCHA challenge). Distinct from rejection (host denial) and timeout. Kept
 * as a named helper so the exit reason ("blocked_recaptcha") has one source of
 * truth and so the detector can be extended (e.g. a blank block page) later.
 * @param {Page} page - Playwright page
 * @returns {Promise<boolean>} - Whether a bot-detection block is present
 */
async function checkForBlocked(page) {
  return hasRecaptchaChallenge(page);
}

/**
 * Check if bot has been rejected from the meeting
 * @param {Page} page - Playwright page
 * @returns {Promise<boolean>} - Whether rejection was detected
 */
async function checkForRejection(page) {
  for (const selector of selectors.googleRejectionIndicators) {
    try {
      const element = page.locator(selector).first();
      const isVisible = await element.isVisible({ timeout: 100 }).catch(() => false);
      if (isVisible) {
        // A reCAPTCHA challenge renders the SAME "Return to home screen"
        // affordance as an admin rejection. If a VISIBLE captcha challenge is on
        // screen, this is Google bot-detection — NOT a host denial — so don't
        // classify it as a rejection (that would make the bot bail before the
        // 'blocked' state can be surfaced). Ported from Vexa 64d3470.
        if (await hasRecaptchaChallenge(page)) {
          console.log(`[GoogleMeet Admission] reCAPTCHA challenge present alongside rejection indicator "${selector}" — treating as bot-detection block, NOT admin rejection`);
          return false;
        }
        console.log(`[GoogleMeet Admission] Rejection detected: ${selector}`);
        return true;
      }
    } catch (e) {
      // Continue checking
    }
  }
  return false;
}

/**
 * Check if bot is in the waiting room
 * @param {Page} page - Playwright page
 * @returns {Promise<boolean>} - Whether bot is in waiting room
 */
async function isInWaitingRoom(page) {
  for (const selector of selectors.googleWaitingRoomIndicators) {
    try {
      const element = page.locator(selector).first();
      const isVisible = await element.isVisible({ timeout: 100 }).catch(() => false);
      if (isVisible) {
        return true;
      }
    } catch (e) {
      // Continue checking
    }
  }
  return false;
}

/**
 * Check if bot has been admitted to the meeting
 * @param {Page} page - Playwright page
 * @returns {Promise<boolean>} - Whether admission was detected
 */
async function checkForAdmission(page) {
  for (const selector of selectors.googleInitialAdmissionIndicators) {
    try {
      // [data-participant-id] exists in the LOBBY too via the self effects-panel
      // phantom, so a raw visibility match there is a false positive. Key on >=1
      // REAL participant tile instead (effects phantom excluded). Ported from
      // Vexa 6f0f6e9.
      if (selector === '[data-participant-id]') {
        const real = await countRealParticipantTiles(page);
        if (real > 0) {
          console.log(`[GoogleMeet Admission] Admitted: ${real} real participant tile(s) present (effects-panel phantom excluded)`);
          return true;
        }
        continue;
      }

      const element = page.locator(selector).first();
      const isVisible = await element.isVisible({ timeout: 200 }).catch(() => false);

      if (isVisible) {
        // Double-check that it's not disabled
        const isDisabled = await element.getAttribute('aria-disabled').catch(() => null);
        if (isDisabled !== 'true') {
          console.log(`[GoogleMeet Admission] Admission indicator found: ${selector}`);
          return true;
        }
      }
    } catch (e) {
      // Continue checking
    }
  }
  return false;
}

/**
 * Wait for bot to be admitted to Google Meet
 * @param {Page} page - Playwright page
 * @param {number} timeout - Maximum time to wait in ms (default: 2 minutes)
 * @param {Object} options - Additional options
 * @returns {Promise<boolean>} - Whether bot was admitted
 */
async function waitForAdmission(page, timeout = 120000, options = {}) {
  const { checkInterval = 2000, onWaitingRoom = null, screenshotPath = null } = options;

  const startTime = Date.now();
  let hasLoggedWaitingRoom = false;
  let hasLoggedBlackScreen = false;

  console.log(`[GoogleMeet Admission] Waiting for admission (timeout: ${timeout / 1000}s)...`);

  // First, check if already admitted
  if (await checkForAdmission(page)) {
    console.log('[GoogleMeet Admission] Bot already admitted to meeting');
    return true;
  }

  // Poll for admission
  while (Date.now() - startTime < timeout) {
    // Check for a genuine reCAPTCHA challenge (Google bot-detection block) BEFORE
    // rejection: the challenge screen shares the "Return to home screen" affordance
    // with admin rejection, so we classify it as a distinct 'blocked' state rather
    // than a generic timeout/rejection. Ported from Vexa 391f661 (#444). A VISIBLE
    // challenge only — the invisible background reCAPTCHA frame present on every
    // join does NOT trip this (see hasRecaptchaChallenge / Vexa 64d3470).
    if (await checkForBlocked(page)) {
      console.log('[GoogleMeet Admission] BLOCKED: visible reCAPTCHA challenge detected — Google bot-detection block');
      if (screenshotPath) {
        const { takeScreenshot } = require('./browser');
        await takeScreenshot(page, screenshotPath, 'blocked_recaptcha');
      }
      const err = new Error('blocked_recaptcha: Google bot-detection reCAPTCHA challenge during admission');
      err.outcome = 'blocked';
      throw err;
    }

    // Check for rejection first
    if (await checkForRejection(page)) {
      throw new Error('Bot admission rejected by meeting admin or meeting ended');
    }

    // Check for admission
    if (await checkForAdmission(page)) {
      console.log('[GoogleMeet Admission] Bot admitted to Google Meet');

      if (screenshotPath) {
        const { takeScreenshot } = require('./browser');
        await takeScreenshot(page, screenshotPath, 'after_admission');
      }

      return true;
    }

    // Check if in waiting room (for logging)
    const inWaitingRoom = await isInWaitingRoom(page);
    if (!hasLoggedWaitingRoom && inWaitingRoom) {
      console.log('[GoogleMeet Admission] Bot is in waiting room, awaiting host admission...');
      hasLoggedWaitingRoom = true;

      if (onWaitingRoom) {
        onWaitingRoom();
      }

      if (screenshotPath) {
        const { takeScreenshot } = require('./browser');
        await takeScreenshot(page, screenshotPath, 'waiting_room');
      }
    }

    // Detect black screen / limbo state (not in waiting room, not admitted, not rejected)
    if (!hasLoggedBlackScreen && !inWaitingRoom) {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      if (elapsed > 10) { // After 10 seconds with no state detected
        console.log('[GoogleMeet Admission] WARNING: Black screen detected - no waiting room indicators visible');
        console.log('[GoogleMeet Admission] This may indicate Google bot detection blocked the join request');
        hasLoggedBlackScreen = true;

        if (screenshotPath) {
          const { takeScreenshot } = require('./browser');
          await takeScreenshot(page, screenshotPath, 'black_screen_limbo');
        }

        // Try to detect by checking page body content
        try {
          const bodyText = await page.locator('body').textContent({ timeout: 1000 });
          console.log(`[GoogleMeet Admission] Page body text (truncated): ${bodyText?.substring(0, 200) || '(empty)'}`);
        } catch (e) {
          console.log('[GoogleMeet Admission] Could not read page body text');
        }
      }
    }

    // Wait before next check
    await page.waitForTimeout(checkInterval);

    // Log progress every 30 seconds
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    if (elapsed % 30 === 0 && elapsed > 0) {
      console.log(`[GoogleMeet Admission] Still waiting... ${elapsed}s elapsed`);
    }
  }

  // Timeout reached. One last blocked-check so a challenge that surfaced late in
  // the window is reported as the honest 'blocked' state rather than a generic
  // timeout (ported from Vexa 391f661 — name the state instead of polling blind).
  if (await checkForBlocked(page)) {
    console.log('[GoogleMeet Admission] BLOCKED at timeout: visible reCAPTCHA challenge — Google bot-detection block');
    if (screenshotPath) {
      const { takeScreenshot } = require('./browser');
      await takeScreenshot(page, screenshotPath, 'blocked_recaptcha');
    }
    const err = new Error('blocked_recaptcha: Google bot-detection reCAPTCHA challenge during admission');
    err.outcome = 'blocked';
    throw err;
  }

  console.log('[GoogleMeet Admission] Admission timeout reached');

  if (screenshotPath) {
    const { takeScreenshot } = require('./browser');
    await takeScreenshot(page, screenshotPath, 'admission_timeout');
  }

  throw new Error('Admission timeout - bot was not admitted to meeting');
}

/**
 * Wait for admission with callback support for status updates
 * @param {Page} page - Playwright page
 * @param {Object} callbacks - Callback functions for status updates
 * @param {number} timeout - Maximum time to wait
 * @returns {Promise<boolean>}
 */
async function waitForAdmissionWithCallbacks(page, callbacks = {}, timeout = 120000) {
  const {
    onAdmitted = null,
    onWaitingRoom = null,
    onRejected = null,
    onTimeout = null,
    onBlocked = null
  } = callbacks;

  try {
    const admitted = await waitForAdmission(page, timeout, {
      onWaitingRoom: onWaitingRoom
    });

    if (admitted && onAdmitted) {
      onAdmitted();
    }

    return admitted;
  } catch (error) {
    // Order matters: a bot-detection block carries outcome:'blocked' and its
    // message also contains "blocked" — surface it as blocked, not rejected.
    if (error.outcome === 'blocked' || error.message.includes('blocked_recaptcha')) {
      if (onBlocked) {
        onBlocked(error.message);
      }
    } else if (error.message.includes('rejected')) {
      if (onRejected) {
        onRejected(error.message);
      }
    } else if (error.message.includes('timeout')) {
      if (onTimeout) {
        onTimeout();
      }
    }
    throw error;
  }
}

/**
 * Check meeting status for removal or connection issues
 * @param {Page} page - Playwright page
 * @returns {Promise<{removed: boolean, reason: string|null}>}
 */
async function checkMeetingStatus(page) {
  for (const selector of selectors.googleRemovalIndicators) {
    try {
      const element = page.locator(selector).first();
      const isVisible = await element.isVisible({ timeout: 100 }).catch(() => false);

      if (isVisible) {
        let reason = 'Meeting ended or connection lost';

        // Try to get more specific reason
        const textContent = await element.textContent().catch(() => null);
        if (textContent) {
          reason = textContent.trim();
        }

        return { removed: true, reason };
      }
    } catch (e) {
      // Continue checking
    }
  }

  return { removed: false, reason: null };
}

module.exports = {
  waitForAdmission,
  waitForAdmissionWithCallbacks,
  checkForAdmission,
  checkForRejection,
  checkForBlocked,
  hasRecaptchaChallenge,
  countRealParticipantTiles,
  isInWaitingRoom,
  checkMeetingStatus
};
