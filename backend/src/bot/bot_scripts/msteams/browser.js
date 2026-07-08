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

// Modern Chrome user-agent string. Some Teams flows gate feature
// availability on the UA, so we present a recent desktop Chrome/Windows
// identity rather than Playwright's default.
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';

// Chromium launch arguments, grouped by the problem each group solves.
// Verified inside the staging worker pod: launches cleanly (no SIGTRAP),
// navigates Teams redirects, and Playwright .fill()/.click() are accepted
// by Teams' React inputs because real X11 events flow through Xvfb (the
// entrypoint already starts Xvfb on :99 — the "fake-headless" pattern).
//
// Note: an earlier head-mode attempt SIGTRAPed when
// `--auto-accept-camera-and-microphone-capture` was stacked on top of
// this set — that flag crashes Chromium in this wolfi base image and is
// intentionally omitted.
function buildLaunchArgs() {
  const sandboxAndIsolation = [
    '--incognito',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-features=IsolateOrigins,site-per-process',
    '--disable-site-isolation-trials',
    '--disable-web-security',
    '--allow-running-insecure-content',
    '--ignore-certificate-errors',
    '--ignore-ssl-errors',
    '--ignore-certificate-errors-spki-list',
  ];

  const gpuAndCompositing = [
    '--disable-gpu',
    // Collapse the gpu-process into the renderer. Without this, a single
    // bot burns roughly 3x the CPU on software-rasterized compositing
    // running in a separate gpu-process — measured against a sustained
    // Teams web call.
    '--in-process-gpu',
    '--disable-features=VizDisplayCompositor',
  ];

  const mediaDevices = [
    '--use-fake-ui-for-media-stream',
    // Keep Chrome's media device graph active inside Docker. Without a
    // fake input device, Teams intermittently drops CSRC/audio-source
    // metadata even though the inbound WebRTC audio track keeps
    // delivering frames.
    '--use-fake-device-for-media-stream',
    '--use-file-for-fake-video-capture=/dev/null',
    '--autoplay-policy=no-user-gesture-required',
  ];

  const backgroundThrottling = [
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
  ];

  const chrome = ['--disable-infobars'];

  return [
    ...sandboxAndIsolation,
    ...gpuAndCompositing,
    ...mediaDevices,
    ...backgroundThrottling,
    ...chrome,
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
