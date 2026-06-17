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
// Apply the hardened stealth recipe to a playwright-extra chromium instance.
// Extracted so generate-auth.js can launch with the SAME stealth config as the
// production bot (the captured session must be consistent with how the bot
// later presents itself).
function buildStealthChromium() {
  const stealthPlugin = StealthPlugin();
  stealthPlugin.enabledEvasions.delete("iframe.contentWindow");
  stealthPlugin.enabledEvasions.delete("media.codecs");
  // Drop user-agent-override: left enabled it forces a Windows UA + Client-Hints
  // onto our Linux Chromium, contradicting navigator.userAgentData (unspoofable)
  // and triggering the bot interstitial. The honest Linux UA we set on the context
  // flows through instead (verified required).
  stealthPlugin.enabledEvasions.delete("user-agent-override");
  chromium.use(stealthPlugin);
  return chromium;
}

buildStealthChromium();

/**
 * Resolve the storageState (auth) file the bot should load, option-driven.
 *
 * Resolution order (first non-empty wins):
 *   1. options.storageStatePath
 *   2. process.env.GOOGLE_AUTH_STATE_PATH
 *
 * GOOGLE_MEET_USE_AUTH is the master toggle, BUT a resolved + EXISTING file is
 * treated as sufficient on its own (so a deployment that mounts the file and
 * forgets the flag still authenticates). When nothing resolves or the file is
 * missing, the bot falls back to anonymous guest.
 *
 * @param {Object} options
 * @param {string} [options.storageStatePath] Explicit path (wins over env).
 * @returns {{ path: string|null, exists: boolean, useAuthRequested: boolean }}
 */
function resolveAuthState(options = {}) {
  const useAuthRequested = process.env.GOOGLE_MEET_USE_AUTH === 'true' || !!options.useAuth;
  const candidate = options.storageStatePath || process.env.GOOGLE_AUTH_STATE_PATH || null;
  const trimmed = candidate && String(candidate).trim() ? String(candidate).trim() : null;
  const exists = trimmed ? fs.existsSync(trimmed) : false;
  return { path: trimmed, exists, useAuthRequested };
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
 * Build the hardened launch options used for both the production bot and the
 * generate-auth CLI. Extracted so the captured auth session is launched with
 * the same flags the bot later runs under.
 * @param {Object} options
 * @param {boolean} [options.headless] Force headless (default: false / headed).
 * @returns {import('playwright').LaunchOptions}
 */
function buildLaunchOptions(options = {}) {
  const isDocker = process.env.RUNNING_IN_DOCKER === 'true';
  // CRITICAL: Google Meet detects headless browsers and blocks them
  // We run with headless: false even in Docker (using the Xvfb virtual display)
  // Our Docker setup has Xvfb on :99, so we can run headed mode
  const headless = options.headless !== undefined ? options.headless : false;

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

  const launchOptions = {
    headless,
    args: launchArgs,
    ignoreDefaultArgs: ['--enable-automation'],
  };

  const browserPath = getBrowserPath();
  if (browserPath) {
    launchOptions.executablePath = browserPath;
  }
  return launchOptions;
}

/**
 * Build the minimal context options (UA derived from the live engine major).
 * Shared with generate-auth so the captured session matches the bot's UA.
 * @param {Object} options
 * @param {string} options.chromeMajor Chromium major version (from browser.version()).
 * @param {string} [options.storageStatePath] When set + caller wants auth, the
 *   resolved storageState file (NOT applied here — caller decides; we just
 *   accept it for symmetry/future use).
 * @returns {import('playwright').BrowserContextOptions}
 */
function buildContextOptions(options = {}) {
  const chromeMajor = options.chromeMajor || '141';
  const dynamicUserAgent = `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeMajor}.0.0.0 Safari/537.36`;
  // Minimal context — matches the reference bot exactly: ONLY permissions,
  // userAgent, viewport. We deliberately do NOT set locale/timezoneId/hasTouch/
  // isMobile/extra HTTP headers: a hardcoded timezone (e.g. America/New_York)
  // can contradict the real egress-IP geolocation, and any context override that
  // doesn't match the actual environment is a fingerprint inconsistency Google
  // Meet can key on. Letting the browser's native values flow keeps everything
  // self-consistent.
  return {
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
}

/**
 * Launch Playwright browser with stealth configuration for Google Meet
 * @param {Object} options - Launch options
 * @param {boolean} options.headless - Run in headless mode (default: based on RUNNING_IN_DOCKER)
 * @param {string} [options.storageStatePath] - Explicit storageState (auth) file path.
 * @param {boolean} [options.useAuth] - Force the auth master toggle on for this launch.
 * @returns {Promise<{browser: Browser, context: BrowserContext, page: Page, authenticated: boolean}>}
 */
async function launchBrowser(options = {}) {
  const isDocker = process.env.RUNNING_IN_DOCKER === 'true';
  const headless = options.headless !== undefined ? options.headless : false;

  console.log(`[GoogleMeet Browser] Launching browser (headless: ${headless}, docker: ${isDocker}, display: ${process.env.DISPLAY || 'not set'})`);

  // Set PULSE_SINK environment variable for Chrome to use virtual speaker
  if (isDocker) {
    process.env.PULSE_SINK = 'virtual_speaker';
    console.log('[GoogleMeet Browser] Set PULSE_SINK=virtual_speaker for audio capture');
  }

  const launchOptions = buildLaunchOptions({ headless });
  if (launchOptions.executablePath) {
    console.log(`[GoogleMeet Browser] Using browser at: ${launchOptions.executablePath}`);
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

  const contextOptions = buildContextOptions({ chromeMajor });

  // ---- Authenticated session resolution (option/env-driven) ---------------
  // storageState JSON (cookies + localStorage) is the auth artifact. We only
  // attach it when a resolved file actually EXISTS; otherwise we fall back to
  // anonymous guest (the default). See resolveAuthState() for the order.
  const auth = resolveAuthState(options);
  let authenticated = false;
  if (auth.path && auth.exists) {
    contextOptions.storageState = auth.path;
    authenticated = true;
    console.log(`[GoogleMeet Browser] AUTHENTICATED session: loading storageState from ${auth.path} (account=${process.env.MEET_NOTETAKER_EMAIL || 'unknown'}) authenticated=true`);
    if (!auth.useAuthRequested) {
      console.log('[GoogleMeet Browser] note: GOOGLE_MEET_USE_AUTH not set to "true", but a resolved auth file exists — treating as sufficient.');
    }
  } else if (auth.path && !auth.exists) {
    console.log(`[GoogleMeet Browser] auth file resolved to ${auth.path} but it does NOT exist — falling back to anonymous guest. authenticated=false`);
  } else if (auth.useAuthRequested) {
    console.log('[GoogleMeet Browser] GOOGLE_MEET_USE_AUTH=true but no GOOGLE_AUTH_STATE_PATH / storageStatePath resolved — falling back to anonymous guest. authenticated=false');
  } else {
    console.log('[GoogleMeet Browser] no auth configured — joining as anonymous guest. authenticated=false');
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

  return { browser, context, page, authenticated };
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
  resolveAuthState,
  buildStealthChromium,
  buildLaunchOptions,
  buildContextOptions,
};
