/**
 * Google Meet Admission Handling
 * Waits for bot to be admitted from waiting room
 */

const selectors = require('./selectors');
const { waitForAnySelector } = require('./join');

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

  // Timeout reached
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
    onTimeout = null
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
    if (error.message.includes('rejected')) {
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
  isInWaitingRoom,
  checkMeetingStatus
};
