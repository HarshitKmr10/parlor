'use strict';

const { chromium: rawChromium } = require('playwright');
const { chromium: extraChromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();

let stealthInstalled = false;
function ensureStealth() {
  if (stealthInstalled) return;
  stealth.enabledEvasions.delete('iframe.contentWindow');
  stealth.enabledEvasions.delete('media.codecs');
  extraChromium.use(stealth);
  stealthInstalled = true;
}

const HARDCODED_DEFAULT_VIEWPORT = { width: 1280, height: 800 };

const PERMISSION_ORIGINS = [
  'https://teams.microsoft.com',
  'https://teams.live.com',
  'https://teams.cloud.microsoft',
];

const PERMISSIONS = ['microphone', 'camera', 'notifications'];

// Modern Chrome user-agent (matches Vexa). Some Teams flows gate features
// on this string.
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';

// Chromium launch arguments — copied verbatim from Vexa's
// vexa-bot/core/src/constans.ts `baseBrowserArgs`. Verified inside the
// staging worker pod: launches cleanly (no SIGTRAP), navigates Teams
// redirects, Playwright .fill()/.click() are accepted by Teams' React
// inputs because real X11 events flow through Xvfb (the entrypoint
// already starts Xvfb on :99 — that's the "fake-headless" trick).
//
// The previous head-mode attempt SIGTRAPed because we were stacking
// `--auto-accept-camera-and-microphone-capture` on top, which crashes
// chromium in this wolfi build. Vexa's arg list omits that flag and is
// stable.
function buildLaunchArgs() {
  return [
    '--incognito',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-features=IsolateOrigins,site-per-process',
    '--disable-infobars',
    '--disable-gpu',
    // Collapse the gpu-process into the renderer. Without this, a single
    // bot would burn ~360% CPU on software-rasterised compositing in a
    // separate gpu-process. See Vexa's notes — measured on Zoom Web cycle.
    '--in-process-gpu',
    '--use-fake-ui-for-media-stream',
    // Keep Chrome's media device graph active inside Docker. Without a fake
    // input device, Teams intermittently drops CSRC/audio-source metadata even
    // though the inbound WebRTC audio track continues to deliver frames.
    '--use-fake-device-for-media-stream',
    '--use-file-for-fake-video-capture=/dev/null',
    '--allow-running-insecure-content',
    '--disable-web-security',
    '--disable-features=VizDisplayCompositor',
    '--ignore-certificate-errors',
    '--ignore-ssl-errors',
    '--ignore-certificate-errors-spki-list',
    '--disable-site-isolation-trials',
    '--autoplay-policy=no-user-gesture-required',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
  ];
}

// Headless decision:
// - Container (Linux + Xvfb already running on :99): headless:false. This
//   is the "fake-headless" pattern — a real Chromium window paints into
//   Xvfb, so all events React/Teams sees are X11-trusted.
// - macOS dev: headless:false too — Chrome runs in a real window. We
//   keep stealth on to dodge Teams' bot detection.
// MSTEAMS_HEADLESS=true forces classic headless (debug only; clicks will
// be ignored by React inputs).
function shouldRunHeadless() {
  if (process.env.MSTEAMS_HEADLESS === 'true') return true;
  if (process.env.MSTEAMS_HEADLESS === 'false') return false;
  return false;
}

// Browser binary path: keep the legacy precedence so the same env vars
// that worked in the previous bot continue to work here.
function getBrowserPath() {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  if (process.platform === 'darwin') {
    return '/Applications/Chromium.app/Contents/MacOS/Chromium';
  }
  if (process.platform === 'linux') return '/usr/bin/chromium';
  return undefined;
}

async function launchBrowser({ logger, executablePath, headless } = {}) {
  ensureStealth();
  const log = logger || console;
  const launcher = process.env.MSTEAMS_USE_STEALTH === 'false' ? rawChromium : extraChromium;
  const useHeadless = headless === undefined ? shouldRunHeadless() : Boolean(headless);

  // On macOS, the bundled "Chrome for Testing" SIGTRAPs on launch; use
  // the system Google Chrome via channel='chrome'. Containers keep
  // CHROME_BIN.
  const channel = process.env.MSTEAMS_CHROME_CHANNEL
    || (process.platform === 'darwin' && !process.env.CHROME_BIN ? 'chrome' : undefined);

  const launchOptions = {
    headless: useHeadless,
    executablePath: executablePath || getBrowserPath(),
    channel,
    args: buildLaunchArgs(),
    ignoreDefaultArgs: ['--enable-automation'],
    chromiumSandbox: process.platform !== 'linux',
  };
  if (channel) {
    delete launchOptions.executablePath;
  }

  log.info?.('[teams.browser] launching chromium', {
    headless: launchOptions.headless,
    exe: launchOptions.executablePath || (channel ? `channel:${channel}` : 'bundled'),
    stealth: launcher === extraChromium,
    sandbox: launchOptions.chromiumSandbox,
    args_count: launchOptions.args.length,
  });

  return launcher.launch(launchOptions);
}

async function newSession(browser, { name, recordVideoDir } = {}) {
  const context = await browser.newContext({
    viewport: HARDCODED_DEFAULT_VIEWPORT,
    userAgent: USER_AGENT,
    locale: 'en-US',
    timezoneId: process.env.MSTEAMS_TZ || 'America/Los_Angeles',
    recordVideo: recordVideoDir ? { dir: recordVideoDir, size: HARDCODED_DEFAULT_VIEWPORT } : undefined,
    permissions: PERMISSIONS,
  });

  for (const origin of PERMISSION_ORIGINS) {
    await context.grantPermissions(PERMISSIONS, { origin }).catch(() => {});
  }

  if (name) {
    await context.addInitScript((displayName) => {
      try {
        window.localStorage.setItem('ts.preferences.global.username', displayName);
      } catch (_err) {
        /* ignore quota errors */
      }
    }, name);
  }

  return context;
}

module.exports = { launchBrowser, newSession };
