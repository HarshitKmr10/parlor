/**
 * Playwright Browser Configuration for Google Meet
 * Uses playwright-extra with the puppeteer stealth plugin
 *
 * IMPORTANT: Google Meet has aggressive bot detection. Key evasion techniques:
 * 1. DO NOT use --use-fake-device-for-media-stream (instant bot flag)
 * 2. Use real WebRTC connections (not mocked)
 * 3. Human-like timing delays
 * 4. Consistent browser fingerprint
 */

const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const path = require('path');
const fs = require('fs');

// Configure stealth plugin (hardened Google Meet recipe).
// NOTE: requires `puppeteer-extra` to be installed (package.json) or several
// evasions (webgl.vendor, chrome.runtime, ...) silently no-op and Google Meet
// flags the raw SwiftShader WebGL renderer → instant "You can't join" reject.
const stealthPlugin = StealthPlugin();
stealthPlugin.enabledEvasions.delete("iframe.contentWindow");
stealthPlugin.enabledEvasions.delete("media.codecs");
// Drop user-agent-override: left enabled it forces a Windows UA + Client-Hints
// onto our Linux Chromium, contradicting navigator.userAgentData (unspoofable)
// and triggering the bot interstitial. The honest Linux UA we set on the context
// flows through instead (verified required).
stealthPlugin.enabledEvasions.delete("user-agent-override");
chromium.use(stealthPlugin);

// Path to auth.json for authenticated sessions
const AUTH_FILE = path.join(__dirname, 'auth.json');

/**
 * Check if authenticated session is available
 * @returns {boolean} True if auth.json exists
 */
function hasAuthFile() {
  return fs.existsSync(AUTH_FILE);
}

/**
 * Get the browser executable path based on environment
 * @returns {string|undefined} Browser path or undefined for default
 */
function getBrowserPath() {
  const isDocker = process.env.RUNNING_IN_DOCKER === 'true';

  if (isDocker) {
    // Docker container paths
    const possiblePaths = [
      '/usr/bin/google-chrome-stable',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium'
    ];

    const fs = require('fs');
    for (const browserPath of possiblePaths) {
      if (fs.existsSync(browserPath)) {
        return browserPath;
      }
    }
  }

  // Use Playwright's bundled browser
  return undefined;
}

/**
 * Launch Playwright browser with stealth configuration for Google Meet
 * @param {Object} options - Launch options
 * @param {boolean} options.headless - Run in headless mode (default: based on RUNNING_IN_DOCKER)
 * @param {string} options.userDataDir - Optional user data directory for persistent sessions
 * @returns {Promise<{browser: Browser, context: BrowserContext, page: Page}>}
 */
async function launchBrowser(options = {}) {
  const isDocker = process.env.RUNNING_IN_DOCKER === 'true';
  // CRITICAL: Google Meet detects headless browsers and blocks them
  // We run with headless: false even in Docker (using the Xvfb virtual display)
  // Our Docker setup has Xvfb on :99, so we can run headed mode
  const headless = options.headless !== undefined ? options.headless : false;

  console.log(`[GoogleMeet Browser] Launching browser (headless: ${headless}, docker: ${isDocker}, display: ${process.env.DISPLAY || 'not set'})`);

  // Hardened browser args for Google Meet bot-detection evasion
  // CRITICAL: Do NOT use --use-fake-device-for-media-stream (instant bot flag)
  // Minimal hardened arg set. The old
  // "Security bypass" flags (--disable-web-security, --allow-running-insecure-
  // content, --ignore-certificate-errors[-spki-list], --ignore-ssl-errors) are
  // detectable by Google's bot layer and directly cause the "You can't join this
  // video call" interstitial — REMOVED. --in-process-gpu added (GPU config
  // alongside --disable-gpu). No --window-size etc. with viewport:null below.
  const launchArgs = [
    '--incognito',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-features=IsolateOrigins,site-per-process',
    '--disable-infobars',
    '--disable-gpu',
    '--in-process-gpu',
    '--use-fake-ui-for-media-stream',
    '--use-file-for-fake-video-capture=/dev/null',
    // Test image has no PulseAudio; feed silence so getUserMedia(mic) resolves.
    // Inert for bot detection.
    '--use-file-for-fake-audio-capture=/dev/null',
    '--disable-blink-features=AutomationControlled',
    '--disable-features=VizDisplayCompositor',
    '--disable-site-isolation-trials',
  ];

  // Add display for Docker environments
  if (isDocker && process.env.DISPLAY) {
    launchArgs.push(`--display=${process.env.DISPLAY}`);
  }

  // Set PULSE_SINK environment variable for Chrome to use virtual speaker
  if (isDocker) {
    process.env.PULSE_SINK = 'virtual_speaker';
    console.log('[GoogleMeet Browser] Set PULSE_SINK=virtual_speaker for audio capture');
  }

  const browserPath = getBrowserPath();
  const launchOptions = {
    headless,
    args: launchArgs,
    ignoreDefaultArgs: ['--enable-automation'],
  };

  if (browserPath) {
    launchOptions.executablePath = browserPath;
    console.log(`[GoogleMeet Browser] Using browser at: ${browserPath}`);
  }

  const browser = await chromium.launch(launchOptions);

  // Derive the UA major from the ACTUAL launched Chromium. This is critical:
  // prod launches Alpine's SYSTEM chromium (getBrowserPath → /usr/bin/chromium-
  // browser, currently 148), while the local test image uses Playwright's bundled
  // chromium. navigator.userAgentData reports the REAL major and CANNOT be spoofed,
  // so any hardcoded mismatch (e.g. UA 141 vs engine 148) contradicts Client-Hints
  // and triggers Google Meet's "You can't join this video call" block BEFORE the
  // join request is ever sent. Reading browser.version() keeps UA ⇄ engine aligned
  // regardless of which Chromium build runs.
  let chromeMajor = '141';
  try {
    const ver = await browser.version();
    const m = /(\d+)\./.exec(ver);
    if (m) chromeMajor = m[1];
    console.log(`[GoogleMeet Browser] Chromium version ${ver} → UA Chrome/${chromeMajor}.0.0.0`);
  } catch (e) {
    console.log(`[GoogleMeet Browser] could not read Chromium version (${e.message}); UA defaults to ${chromeMajor}`);
  }
  const dynamicUserAgent = `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeMajor}.0.0.0 Safari/537.36`;

  // Check if we should use authenticated session
  const useAuth = process.env.GOOGLE_MEET_USE_AUTH === 'true' || options.useAuth;
  const authAvailable = hasAuthFile();

  if (useAuth && authAvailable) {
    console.log('[GoogleMeet Browser] Using authenticated session from auth.json');
  } else if (useAuth && !authAvailable) {
    console.log('[GoogleMeet Browser] GOOGLE_MEET_USE_AUTH=true but auth.json not found, proceeding as guest');
  }

  // Minimal context — matches the reference bot exactly: ONLY permissions,
  // userAgent, viewport. We deliberately do NOT set locale/timezoneId/hasTouch/
  // isMobile/extra HTTP headers: a hardcoded timezone (e.g. America/New_York)
  // can contradict the real egress-IP geolocation, and any context override that
  // doesn't match the actual environment is a fingerprint inconsistency Google
  // Meet can key on. Letting the browser's native values flow keeps everything
  // self-consistent.
  const contextOptions = {
    permissions: ['camera', 'microphone'],
    // Honest Linux UA whose Chrome major is derived from the live engine above
    // (NOT hardcoded) so it always matches navigator.userAgentData. Paired with
    // the deleted user-agent-override stealth evasion (BOTH required).
    userAgent: dynamicUserAgent,
    // viewport:null — window fills the Xvfb display so
    // innerWidth/outerWidth/screen.width agree (a fixed viewport on a larger
    // window is a detectable size inconsistency).
    viewport: null,
  };

  // Load authenticated session if available and requested
  if (useAuth && authAvailable) {
    contextOptions.storageState = AUTH_FILE;
  } else if (options.userDataDir) {
    contextOptions.storageState = options.userDataDir;
  }

  const context = await browser.newContext(contextOptions);

  // NO hand-rolled navigator/window overrides. The stealth plugin (with
  // puppeteer-extra installed) is the SINGLE source of truth for webdriver,
  // plugins, window.chrome, WebGL vendor, languages, etc. — all mutually
  // consistent. The old block forced navigator.platform=Win32 on Linux + faked
  // window.chrome, contradicting the honest Linux UA/userAgentData and doubling
  // up against the plugin — exactly the self-inconsistent fingerprint Meet flags.

  // Create page
  const page = await context.newPage();

  // NO setExtraHTTPHeaders override — the reference bot doesn't set one; a
  // hardcoded Accept-Language can disagree with navigator.languages/locale and
  // the egress IP. Let the browser send its native, consistent headers.

  console.log('[GoogleMeet Browser] Browser launched successfully');

  return { browser, context, page };
}

/**
 * Close browser and all associated resources
 * @param {Browser} browser - Playwright browser instance
 */
async function closeBrowser(browser) {
  if (browser) {
    try {
      await browser.close();
      console.log('[GoogleMeet Browser] Browser closed');
    } catch (error) {
      console.error('[GoogleMeet Browser] Error closing browser:', error.message);
    }
  }
}

/**
 * Take a screenshot for debugging
 * @param {Page} page - Playwright page instance
 * @param {string} savePath - Directory to save screenshot
 * @param {string} name - Screenshot name
 */
async function takeScreenshot(page, savePath, name = 'screenshot') {
  try {
    const fs = require('fs');
    if (!fs.existsSync(savePath)) {
      fs.mkdirSync(savePath, { recursive: true });
    }

    const screenshotPath = path.join(savePath, `${name}_${Date.now()}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`[GoogleMeet Browser] Screenshot saved: ${screenshotPath}`);
    return screenshotPath;
  } catch (error) {
    console.error('[GoogleMeet Browser] Error taking screenshot:', error.message);
    return null;
  }
}

module.exports = {
  launchBrowser,
  closeBrowser,
  takeScreenshot,
  getBrowserPath,
  hasAuthFile,
  AUTH_FILE
};
