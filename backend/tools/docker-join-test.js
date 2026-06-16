/**
 * Linux/Xvfb validation runner for the Google Meet join.
 * Uses the REAL bot modules: browser.js (stealth launch) + join.js (now wired to
 * the vendored humanized input module) + admission.js. Run inside the container
 * under Xvfb with xdotool available so join.js auto-selects HUMANIZED input.
 */
'use strict';

const { launchBrowser, closeBrowser } = require('../src/bot/bot_scripts/googlemeet/browser');
const { joinGoogleMeetMeeting } = require('../src/bot/bot_scripts/googlemeet/join');
const { waitForAdmission } = require('../src/bot/bot_scripts/googlemeet/admission');

(async () => {
  const url = process.env.MEETING_URL;
  const name = process.env.BOT_NAME || 'Notetaker';
  if (!url) { console.error('MEETING_URL required'); process.exit(2); }

  const { browser, page } = await launchBrowser({});
  let t0 = Date.now();
  try {
    await joinGoogleMeetMeeting(page, url, name, { takeScreenshots: true, screenshotPath: '/tmp/shots' });
    console.log('[runner] join requested — waiting for admission (120s). ADMIT the bot in your Meet.');
    t0 = Date.now();
    await waitForAdmission(page, 120000);
    console.log(`[runner] RESULT: ✅ ADMITTED after ${((Date.now() - t0) / 1000).toFixed(1)}s — join PASSED`);
    await page.waitForTimeout(6000);
  } catch (e) {
    console.log(`[runner] RESULT: ❌ after ${((Date.now() - t0) / 1000).toFixed(1)}s post-join: ${e.message}`);
    // Diagnostic: show EXACTLY what page we landed on, not an inference.
    try {
      console.log(`[runner] DIAG url=${page.url()}`);
      console.log(`[runner] DIAG title=${await page.title().catch(() => '(no title)')}`);
      const bodyText = await page.evaluate(() => (document.body && document.body.innerText || '').slice(0, 600)).catch(() => '(no body)');
      console.log(`[runner] DIAG bodyText<<<\n${bodyText}\n>>>`);
      await page.screenshot({ path: '/tmp/shots/result.png', fullPage: false });
      console.log('[runner] DIAG screenshot=/tmp/shots/result.png');
    } catch (de) { console.log('[runner] DIAG failed:', de.message); }
  } finally {
    await closeBrowser(browser);
  }
})().catch((e) => { console.error('[runner] fatal:', e); process.exit(1); });
