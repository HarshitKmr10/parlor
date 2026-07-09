/**
 * Google Meet Join Flow
 * Handles navigation, name entry, mic/camera toggle, and join click
 */

const selectors = require('./selectors');

/**
 * Wait for any of the given selectors to become visible
 * @param {Page} page - Playwright page
 * @param {string[]} selectorList - Array of selectors to check
 * @param {number} timeout - Maximum time to wait in ms
 * @returns {Promise<string|null>} - The matched selector or null
 */
async function waitForAnySelector(page, selectorList, timeout = 30000) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    for (const selector of selectorList) {
      try {
        const element = page.locator(selector).first();
        const isVisible = await element.isVisible({ timeout: 100 }).catch(() => false);
        if (isVisible) {
          return selector;
        }
      } catch (e) {
        // Selector not found, continue
      }
    }
    await page.waitForTimeout(500);
  }

  return null;
}

/**
 * Like waitForAnySelector, but returns a live ElementHandle for the first visible
 * match (clickHandle/fillField operate on ElementHandles, not Locators).
 * @param {Page} page - Playwright page
 * @param {string[]} selectorList - selectors to race
 * @param {number} timeout - max wait ms
 * @returns {Promise<{handle: import('playwright').ElementHandle|null, selector: string|null}>}
 */
async function waitForAnyHandle(page, selectorList, timeout = 30000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    for (const selector of selectorList) {
      try {
        const loc = selector.startsWith('//')
          ? page.locator(`xpath=${selector}`).first()
          : page.locator(selector).first();
        if (await loc.isVisible({ timeout: 100 }).catch(() => false)) {
          const handle = await loc.elementHandle().catch(() => null);
          if (handle) return { handle, selector };
        }
      } catch (e) {
        // continue
      }
    }
    await page.waitForTimeout(300);
  }
  return { handle: null, selector: null };
}

/**
 * Click the first visible and enabled element from a list of selectors
 * @param {Page} page - Playwright page
 * @param {string[]} selectorList - Array of selectors to try
 * @param {Object} options - Click options
 * @returns {Promise<boolean>} - Whether click was successful
 */
async function clickFirstAvailable(page, selectorList, options = {}) {
  const { timeout = 5000, description = 'element' } = options;

  for (const selector of selectorList) {
    try {
      const element = page.locator(selector).first();
      const isVisible = await element.isVisible({ timeout: 500 }).catch(() => false);

      if (isVisible) {
        const isDisabled = await element.getAttribute('aria-disabled').catch(() => null);
        if (isDisabled === 'true') {
          console.log(`[GoogleMeet Join] ${description} found but disabled: ${selector}`);
          continue;
        }

        await element.click({ timeout });
        console.log(`[GoogleMeet Join] Clicked ${description}: ${selector}`);
        return true;
      }
    } catch (e) {
      // Continue to next selector
    }
  }

  console.log(`[GoogleMeet Join] Could not find clickable ${description}`);
  return false;
}

/**
 * Mute microphone before joining
 * @param {Page} page - Playwright page
 */
async function muteMicrophone(page) {
  try {
    // Look for "Turn off microphone" button (meaning mic is ON, we need to turn it OFF)
    const micOnSelectors = [
      'button[aria-label*="Turn off microphone"]',
      '[aria-label*="Turn off microphone"]',
      'button[data-is-muted="false"][aria-label*="microphone"]'
    ];

    const clicked = await clickFirstAvailable(page, micOnSelectors, {
      timeout: 3000,
      description: 'microphone mute button'
    });

    if (clicked) {
      console.log('[GoogleMeet Join] Microphone muted');
    } else {
      console.log('[GoogleMeet Join] Microphone already muted or button not found');
    }
  } catch (error) {
    console.log('[GoogleMeet Join] Could not mute microphone:', error.message);
  }
}

/**
 * Turn off camera before joining
 * @param {Page} page - Playwright page
 */
async function turnOffCamera(page) {
  try {
    // Look for "Turn off camera" button (meaning camera is ON, we need to turn it OFF)
    const cameraOnSelectors = [
      'button[aria-label*="Turn off camera"]',
      '[aria-label*="Turn off camera"]',
      'button[data-is-muted="false"][aria-label*="camera"]'
    ];

    const clicked = await clickFirstAvailable(page, cameraOnSelectors, {
      timeout: 3000,
      description: 'camera off button'
    });

    if (clicked) {
      console.log('[GoogleMeet Join] Camera turned off');
    } else {
      console.log('[GoogleMeet Join] Camera already off or button not found');
    }
  } catch (error) {
    console.log('[GoogleMeet Join] Could not turn off camera:', error.message);
  }
}

/**
 * Enter bot name in the name input field
 * @param {Page} page - Playwright page
 * @param {string} botName - Name to enter
 * @returns {Promise<boolean>} - Whether name was entered successfully
 */
async function enterBotName(page, botName) {
  console.log(`[GoogleMeet Join] Entering bot name: ${botName}`);

  for (const selector of selectors.googleNameInputSelectors) {
    try {
      const input = page.locator(selector).first();
      const isVisible = await input.isVisible({ timeout: 2000 }).catch(() => false);

      if (isVisible) {
        // Clear existing text and enter new name
        await input.fill('');
        await input.fill(botName);
        console.log(`[GoogleMeet Join] Name entered using selector: ${selector}`);
        return true;
      }
    } catch (e) {
      // Continue to next selector
    }
  }

  console.log('[GoogleMeet Join] Could not find name input field');
  return false;
}

/**
 * Click the join button
 * @param {Page} page - Playwright page
 * @returns {Promise<boolean>} - Whether join was clicked successfully
 */
async function clickJoinButton(page) {
  console.log('[GoogleMeet Join] Looking for join button...');

  // Try each join button selector
  for (const selector of selectors.googleJoinButtonSelectors) {
    try {
      let element;

      // Handle XPath selectors differently
      if (selector.startsWith('//')) {
        element = page.locator(`xpath=${selector}`).first();
      } else {
        element = page.locator(selector).first();
      }

      const isVisible = await element.isVisible({ timeout: 2000 }).catch(() => false);

      if (isVisible) {
        const isDisabled = await element.getAttribute('aria-disabled').catch(() => null);
        if (isDisabled === 'true') {
          console.log(`[GoogleMeet Join] Join button found but disabled: ${selector}`);
          continue;
        }

        await element.click({ timeout: 5000 });
        console.log(`[GoogleMeet Join] Clicked join button: ${selector}`);
        return true;
      }
    } catch (e) {
      // Continue to next selector
    }
  }

  console.log('[GoogleMeet Join] Could not find join button');
  return false;
}

/**
 * Build the input helpers (clickHandle / fillField) used by both the
 * authenticated and anonymous join paths — plain Playwright synthetic
 * click/fill. Kept as a builder (rather than calling page.fill/handle.click
 * directly at each call site) so both join branches share one implementation.
 * @param {Page} page
 * @returns {{ clickHandle: Function, fillField: Function }}
 */
function buildInputHelpers(page) {
  const clickHandle = async (handle, _label) => {
    await handle.click({ timeout: 5000 });
  };
  const fillField = async (_handle, selector, text, _label) => {
    await page.fill(selector, '').catch(() => {});
    await page.fill(selector, text);
  };

  return { clickHandle, fillField };
}

/**
 * Authenticated (signed-in) join branch: skip name entry, mute mic/cam,
 * then RACE "Join now" / "Switch here" /
 * "Ask to join". If ONLY "Ask to join" appears, the cookies didn't actually
 * authenticate the session — we log that, fill the bot name, and fall back to
 * the anonymous lobby path.
 * @returns {Promise<{joined: boolean, stale: boolean}>}
 */
async function joinAuthenticated(page, botName, helpers, ctx = {}) {
  const { clickHandle, fillField } = helpers;
  const { screenshotPath = null, takeScreenshots = false } = ctx;
  const maybeShot = async (name) => {
    if (takeScreenshots && screenshotPath) {
      const { takeScreenshot } = require('./browser');
      await takeScreenshot(page, screenshotPath, name).catch(() => {});
    }
  };

  console.log('[GoogleMeet Join] Authenticated mode: skipping name input (using Google account identity)');
  // Lobby SPA needs a moment after domcontentloaded to render the controls.
  await page.waitForTimeout(3000);
  await maybeShot('auth_lobby');

  // Mute mic + camera (same click path as anonymous).
  try {
    const { handle: micH } = await waitForAnyHandle(page, selectors.googleMicrophoneButtonSelectors, 3000);
    if (micH) { await clickHandle(micH, 'microphone'); console.log('[GoogleMeet Join] Microphone muted'); }
  } catch (e) { console.log('[GoogleMeet Join] Microphone already muted or not found'); }
  try {
    const { handle: camH } = await waitForAnyHandle(page, selectors.googleCameraButtonSelectors, 3000);
    if (camH) { await clickHandle(camH, 'camera'); console.log('[GoogleMeet Join] Camera turned off'); }
  } catch (e) { console.log('[GoogleMeet Join] Camera already off or not found'); }

  // Race the three possible authenticated outcomes. A direct in-call join shows
  // "Join now"; same-account-elsewhere shows "Switch here"; a session that
  // DIDN'T authenticate falls through to "Ask to join".
  const raceSelectors = [
    ...selectors.googleJoinNowSelectors.map((s) => ({ selector: s, type: 'join_now' })),
    ...selectors.googleSwitchHereSelectors.map((s) => ({ selector: s, type: 'switch_here' })),
    ...selectors.googleJoinButtonSelectors.map((s) => ({ selector: s, type: 'ask_to_join' })),
  ];

  const startTime = Date.now();
  const timeout = 30000;
  let matched = null;
  while (Date.now() - startTime < timeout && !matched) {
    for (const { selector, type } of raceSelectors) {
      try {
        const loc = selector.startsWith('//')
          ? page.locator(`xpath=${selector}`).first()
          : page.locator(selector).first();
        if (await loc.isVisible({ timeout: 50 }).catch(() => false)) {
          const handle = await loc.elementHandle().catch(() => null);
          if (handle) { matched = { type, selector, handle }; break; }
        }
      } catch (_) { /* continue */ }
    }
    if (!matched) await page.waitForTimeout(200);
  }

  if (!matched) {
    await maybeShot('auth_no_join_button');
    throw new Error('authenticated join: no Join now / Switch here / Ask to join button after 30s');
  }

  if (matched.type === 'join_now') {
    await clickHandle(matched.handle, 'join_now');
    console.log('[GoogleMeet Join] Joined as authenticated user (Join now)');
    await maybeShot('after_join_now');
    return { joined: true, stale: false };
  }
  if (matched.type === 'switch_here') {
    await clickHandle(matched.handle, 'switch_here');
    console.log('[GoogleMeet Join] Joined as authenticated user (Switch here — same account already in call)');
    await maybeShot('after_switch_here');
    return { joined: true, stale: false };
  }

  // type === 'ask_to_join' → cookies did NOT authenticate the session. Distinct
  // STALE signal so the caller / logs can tell a stale auth file apart from a
  // legitimately-anonymous join.
  console.log('[GoogleMeet Join] STALE_AUTH_SESSION: authenticated mode but only "Ask to join" appeared — cookies did not authenticate. Falling back to anonymous name entry.');
  await maybeShot('auth_session_stale');
  // Fill the bot name (we're in anonymous territory now).
  const { handle: nameHandle, selector: nameSel } = await waitForAnyHandle(
    page, selectors.googleNameInputSelectors, 5000);
  if (nameHandle) {
    await fillField(nameHandle, nameSel, botName, 'name');
    console.log(`[GoogleMeet Join] Name entered (fallback): ${botName}`);
  } else {
    console.log('[GoogleMeet Join] No name field found during stale-auth fallback');
  }
  await clickHandle(matched.handle, 'ask_to_join');
  console.log('[GoogleMeet Join] Requested to join via fallback (Ask to join)');
  await maybeShot('after_join_click');
  return { joined: true, stale: true };
}

/**
 * Main function to join a Google Meet meeting
 * @param {Page} page - Playwright page instance
 * @param {string} meetingUrl - Google Meet URL
 * @param {string} botName - Display name for the bot
 * @param {Object} options - Additional options
 * @param {boolean} [options.authenticated] - Use the signed-in join flow.
 * @returns {Promise<boolean>} - Whether join request was successful
 */
async function joinGoogleMeetMeeting(page, meetingUrl, botName, options = {}) {
  const { screenshotPath = null, takeScreenshots = false, authenticated = false } = options;

  console.log(`[GoogleMeet Join] Starting join process for: ${meetingUrl}`);
  console.log(`[GoogleMeet Join] Bot name: ${botName}`);
  console.log(`[GoogleMeet Join] Auth mode: ${authenticated ? 'AUTHENTICATED (signed-in)' : 'anonymous guest'}`);

  // Build the input helpers ONCE so both the authenticated and anonymous
  // paths share the same click/fill implementation.
  const { clickHandle, fillField } = buildInputHelpers(page);

  try {
    // Navigate to meeting URL. `domcontentloaded` is enough — Meet keeps
    // opening connections (telemetry, simulcast negotiation) so
    // `networkidle` can hang for several extra seconds with no benefit
    // to us. We poll for one of {name_input, rejection, admitted} below
    // anyway, so a slightly less-settled page only changes the first
    // few iterations of that poll, not the eventual outcome.
    console.log('[GoogleMeet Join] Navigating to meeting URL...');
    await page.goto(meetingUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    // Bring page to front
    await page.bringToFront();

    // No fixed settle delay: the loop below races the same selectors
    // and exits the moment any one of them is visible, so the previous
    // unconditional 5 s waitForTimeout was pure padding.

    if (takeScreenshots && screenshotPath) {
      const { takeScreenshot } = require('./browser');
      await takeScreenshot(page, screenshotPath, 'after_navigation');
    }

    // Authenticated (signed-in) join: distinct flow — no name input, races
    // "Join now" / "Switch here" / "Ask to join" and falls back to anonymous
    // name entry if the session turns out stale (only "Ask to join" appears).
    if (authenticated) {
      const result = await joinAuthenticated(page, botName, { clickHandle, fillField }, { screenshotPath, takeScreenshots });
      console.log(`[GoogleMeet Join] ${botName} requested to join Google Meet (authenticated, stale_session=${result.stale})`);
      return true;
    }

    // Wait for either: name input (success), rejection (fail), or admission (already in meeting)
    // This handles all cases in parallel rather than sequential checks
    console.log('[GoogleMeet Join] Waiting for meeting state (name input, rejection, or admission)...');

    const allPossibleSelectors = [
      ...selectors.googleNameInputSelectors.map(s => ({ selector: s, type: 'name_input' })),
      ...selectors.googleRejectionIndicators.map(s => ({ selector: s, type: 'rejection' })),
      ...selectors.googleInitialAdmissionIndicators.map(s => ({ selector: s, type: 'admitted' }))
    ];

    const startTime = Date.now();
    const timeout = 60000;
    let matchedResult = null;

    while (Date.now() - startTime < timeout) {
      for (const { selector, type } of allPossibleSelectors) {
        try {
          const element = page.locator(selector).first();
          const isVisible = await element.isVisible({ timeout: 50 }).catch(() => false);
          if (isVisible) {
            matchedResult = { selector, type };
            break;
          }
        } catch (e) {
          // Selector not found, continue
        }
      }

      if (matchedResult) break;
      await page.waitForTimeout(150);
    }

    if (!matchedResult) {
      // Take debug screenshot before failing
      if (takeScreenshots && screenshotPath) {
        const { takeScreenshot } = require('./browser');
        await takeScreenshot(page, screenshotPath, 'timeout_no_state_detected');
      }
      throw new Error('Timeout waiting for meeting state - no name input, rejection, or admission detected');
    }

    console.log(`[GoogleMeet Join] Detected state: ${matchedResult.type} via selector: ${matchedResult.selector}`);

    // Handle rejection
    if (matchedResult.type === 'rejection') {
      // Diagnostic: scrape the actual dialog text + visible body text
      // so we can tell a real rejection from a misclassified device
      // warning (e.g. "Camera not found", "Microphone not found"). The
      // earlier broad :has-text("not found") selector caused exactly
      // that — bot bailing on a benign device banner. Even with
      // tightened selectors, log what fired so future drift is
      // visible immediately in worker logs.
      const diag = await page.evaluate(() => {
        const dialogs = Array.from(document.querySelectorAll('[role="dialog"], [role="alertdialog"]'))
          .filter((el) => el.offsetParent !== null)
          .map((el) => (el.textContent || '').trim().slice(0, 240));
        const bodySnippet = (document.body?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 280);
        return { dialogs, bodySnippet, url: location.href };
      }).catch(() => null);
      console.log('[GoogleMeet Join] rejection diagnostic:', JSON.stringify(diag));
      if (takeScreenshots && screenshotPath) {
        const { takeScreenshot } = require('./browser');
        await takeScreenshot(page, screenshotPath, 'meeting_rejected');
      }
      throw new Error(`Meeting rejected: ${matchedResult.selector}`);
    }

    // Handle already admitted (skip name entry)
    if (matchedResult.type === 'admitted') {
      console.log('[GoogleMeet Join] Already in meeting, skipping name entry');
      return true;
    }

    // Proceed with name entry (matchedResult.type === 'name_input').
    // clickHandle / fillField were built once at the top of
    // joinGoogleMeetMeeting() and are shared with the authenticated path.

    // Name (handle for the field we just detected)
    const { handle: nameHandle, selector: nameSel } = await waitForAnyHandle(
      page, selectors.googleNameInputSelectors, 120000);
    if (nameHandle) {
      await fillField(nameHandle, nameSel, botName, 'name');
      console.log(`[GoogleMeet Join] Name entered: ${botName}`);
    } else {
      console.log('[GoogleMeet Join] Warning: could not resolve name input handle');
    }

    // Mute mic + turn off camera (best-effort: short wait, click if present)
    try {
      const { handle: micH } = await waitForAnyHandle(page, selectors.googleMicrophoneButtonSelectors, 2000);
      if (micH) { await clickHandle(micH, 'microphone'); console.log('[GoogleMeet Join] Microphone muted'); }
    } catch (e) { console.log('[GoogleMeet Join] Microphone already muted or not found'); }
    try {
      const { handle: camH } = await waitForAnyHandle(page, selectors.googleCameraButtonSelectors, 2000);
      if (camH) { await clickHandle(camH, 'camera'); console.log('[GoogleMeet Join] Camera turned off'); }
    } catch (e) { console.log('[GoogleMeet Join] Camera already off or not found'); }

    if (takeScreenshots && screenshotPath) {
      const { takeScreenshot } = require('./browser');
      await takeScreenshot(page, screenshotPath, 'before_join_click');
    }

    // Ask to join
    const { handle: joinHandle } = await waitForAnyHandle(
      page, selectors.googleJoinButtonSelectors, 60000);
    if (!joinHandle) {
      throw new Error('Could not find join button');
    }
    await clickHandle(joinHandle, 'ask_to_join');

    console.log(`[GoogleMeet Join] ${botName} requested to join Google Meet`);

    if (takeScreenshots && screenshotPath) {
      const { takeScreenshot } = require('./browser');
      await page.waitForTimeout(2000);
      await takeScreenshot(page, screenshotPath, 'after_join_click');
    }

    return true;

  } catch (error) {
    console.error(`[GoogleMeet Join] Error joining meeting: ${error.message}`);
    throw error;
  }
}

module.exports = {
  joinGoogleMeetMeeting,
  joinAuthenticated,
  buildInputHelpers,
  enterBotName,
  clickJoinButton,
  muteMicrophone,
  turnOffCamera,
  waitForAnySelector,
  clickFirstAvailable
};
