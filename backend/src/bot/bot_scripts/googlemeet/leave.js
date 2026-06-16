/**
 * Google Meet Leave Functionality
 * Handles leaving the meeting gracefully
 */

const selectors = require('./selectors');

/**
 * Prepare leave function in browser context for later use
 * @param {Page} page - Playwright page
 */
async function prepareForLeave(page) {
  await page.evaluate((leaveSelectors) => {
    /**
     * Try to click a leave button from the selector list
     * @returns {Promise<boolean>}
     */
    window.__gmeetPerformLeave = async () => {
      for (const selector of leaveSelectors) {
        try {
          // Handle different selector types
          let elements;
          if (selector.startsWith('//')) {
            // XPath
            const result = document.evaluate(selector, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
            elements = [];
            for (let i = 0; i < result.snapshotLength; i++) {
              elements.push(result.snapshotItem(i));
            }
          } else if (selector.includes(':has-text(')) {
            // Playwright-style :has-text selector - need to handle manually
            const textMatch = selector.match(/:has-text\("([^"]+)"\)/);
            if (textMatch) {
              const text = textMatch[1];
              const baseSelector = selector.split(':has-text')[0] || '*';
              elements = Array.from(document.querySelectorAll(baseSelector))
                .filter(el => el.textContent.includes(text));
            } else {
              continue;
            }
          } else {
            elements = document.querySelectorAll(selector);
          }

          for (const button of elements) {
            // Check visibility
            const rect = button.getBoundingClientRect();
            const style = getComputedStyle(button);

            const isVisible = rect.width > 0 &&
                            rect.height > 0 &&
                            style.display !== 'none' &&
                            style.visibility !== 'hidden' &&
                            style.opacity !== '0';

            if (!isVisible) continue;

            // Check if enabled
            const isDisabled = button.disabled ||
                              button.getAttribute('aria-disabled') === 'true';

            if (isDisabled) continue;

            // Scroll into view if needed
            button.scrollIntoView({ behavior: 'instant', block: 'center' });

            // Wait a tick
            await new Promise(r => setTimeout(r, 100));

            // Click
            button.click();
            console.log(`[GoogleMeet Leave] Clicked: ${selector}`);
            return true;
          }
        } catch (e) {
          // Continue to next selector
        }
      }
      return false;
    };

    console.log('[GoogleMeet Leave] Leave function prepared');
  }, selectors.googleLeaveSelectors);
}

/**
 * Leave the Google Meet meeting
 * @param {Page} page - Playwright page
 * @param {string} reason - Reason for leaving (for logging)
 * @returns {Promise<boolean>} - Whether leave was successful
 */
async function leaveGoogleMeet(page, reason = 'manual_leave') {
  if (!page || page.isClosed()) {
    console.log('[GoogleMeet Leave] Page already closed');
    return false;
  }

  console.log(`[GoogleMeet Leave] Attempting to leave meeting (reason: ${reason})`);

  try {
    // First try using the prepared function
    let result = await page.evaluate(() => {
      if (window.__gmeetPerformLeave) {
        return window.__gmeetPerformLeave();
      }
      return false;
    }).catch(() => false);

    if (result) {
      console.log('[GoogleMeet Leave] Successfully clicked leave button');

      // Wait for any confirmation dialog
      await page.waitForTimeout(1000);

      // Try to click confirmation if present
      await handleLeaveConfirmation(page);

      return true;
    }

    // Fallback: try direct Playwright selectors
    console.log('[GoogleMeet Leave] Trying direct selectors...');

    for (const selector of selectors.googleLeaveSelectors) {
      try {
        // Skip complex selectors for direct approach
        if (selector.includes(':has-text(') || selector.startsWith('//')) {
          continue;
        }

        const element = page.locator(selector).first();
        const isVisible = await element.isVisible({ timeout: 500 }).catch(() => false);

        if (isVisible) {
          await element.click({ timeout: 2000 });
          console.log(`[GoogleMeet Leave] Clicked via Playwright: ${selector}`);

          // Wait for any confirmation dialog
          await page.waitForTimeout(1000);
          await handleLeaveConfirmation(page);

          return true;
        }
      } catch (e) {
        // Continue to next selector
      }
    }

    // Try text-based selectors as last resort
    console.log('[GoogleMeet Leave] Trying text-based selectors...');

    const textSelectors = [
      'button:has-text("Leave call")',
      'button:has-text("Leave")',
      'button:has-text("End meeting")',
      'button:has-text("Hang up")'
    ];

    for (const selector of textSelectors) {
      try {
        const element = page.locator(selector).first();
        const isVisible = await element.isVisible({ timeout: 500 }).catch(() => false);

        if (isVisible) {
          await element.click({ timeout: 2000 });
          console.log(`[GoogleMeet Leave] Clicked text selector: ${selector}`);

          await page.waitForTimeout(1000);
          await handleLeaveConfirmation(page);

          return true;
        }
      } catch (e) {
        // Continue
      }
    }

    console.log('[GoogleMeet Leave] Could not find any leave button');
    return false;

  } catch (error) {
    console.error(`[GoogleMeet Leave] Error leaving meeting: ${error.message}`);
    return false;
  }
}

/**
 * Handle leave confirmation dialog if it appears
 * @param {Page} page - Playwright page
 */
async function handleLeaveConfirmation(page) {
  const confirmSelectors = [
    'button:has-text("Leave meeting")',
    'button:has-text("Just leave the meeting")',
    '[role="dialog"] button:has-text("Leave")',
    '[role="alertdialog"] button:has-text("Leave")',
    'button:has-text("Leave")'
  ];

  for (const selector of confirmSelectors) {
    try {
      const element = page.locator(selector).first();
      const isVisible = await element.isVisible({ timeout: 500 }).catch(() => false);

      if (isVisible) {
        await element.click({ timeout: 2000 });
        console.log(`[GoogleMeet Leave] Clicked confirmation: ${selector}`);
        return;
      }
    } catch (e) {
      // Continue
    }
  }
}

/**
 * Close any error dialogs that might appear
 * @param {Page} page - Playwright page
 */
async function closeErrorDialogs(page) {
  const closeSelectors = [
    'button:has-text("Close")',
    'button[aria-label="Close"]',
    'button:has-text("OK")',
    'button:has-text("Dismiss")',
    '[role="dialog"] button:first-child'
  ];

  for (const selector of closeSelectors) {
    try {
      const element = page.locator(selector).first();
      const isVisible = await element.isVisible({ timeout: 300 }).catch(() => false);

      if (isVisible) {
        await element.click({ timeout: 1000 });
        console.log(`[GoogleMeet Leave] Closed dialog: ${selector}`);
        await page.waitForTimeout(500);
      }
    } catch (e) {
      // Continue
    }
  }
}

/**
 * Force leave by closing the browser context
 * @param {Browser} browser - Playwright browser
 * @param {BrowserContext} context - Playwright context
 */
async function forceLeave(browser, context) {
  console.log('[GoogleMeet Leave] Force leaving meeting...');

  try {
    if (context) {
      await context.close();
    }
    if (browser) {
      await browser.close();
    }
    console.log('[GoogleMeet Leave] Browser closed');
  } catch (error) {
    console.error(`[GoogleMeet Leave] Error force leaving: ${error.message}`);
  }
}

module.exports = {
  prepareForLeave,
  leaveGoogleMeet,
  handleLeaveConfirmation,
  closeErrorDialogs,
  forceLeave
};
