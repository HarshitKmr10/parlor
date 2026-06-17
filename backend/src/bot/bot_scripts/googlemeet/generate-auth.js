#!/usr/bin/env node
'use strict';

/**
 * Google Meet Authentication Generator (CLI)
 *
 * Produces a Playwright `storageState` JSON capturing a logged-in Google
 * session (cookies + localStorage). The bot loads this file to join meetings
 * as an authenticated Workspace user — internal Meet meetings then auto-admit
 * the bot instead of dropping it in the "Ask to join" lobby.
 *
 * Usage:
 *   node generate-auth.js --account bot@yourco.com --out /secrets/auth/bot.json [--force]
 *
 * Flags:
 *   --account <email>   Google account you will sign in as (pre-filled, NEVER
 *                       auto-typed password — auto-typing trips Google's bot
 *                       detection). REQUIRED.
 *   --out <path>        Where to write the storageState JSON. REQUIRED.
 *   --force             Overwrite an existing --out file (no interactive prompt).
 *   --help              Show this help.
 *
 * The script:
 *   1. Launches a HEADFUL Chromium (mandatory — 2FA needs a real window) with
 *      the SAME stealth/UA/locale config the production bot uses, so the
 *      captured session is consistent with how the bot later presents itself.
 *   2. Pre-fills ONLY the email field; you type the password + complete 2FA
 *      manually in the window.
 *   3. Polls meet.google.com until it detects a logged-in session.
 *   4. Writes the storageState JSON to --out (creating parent dirs).
 *   5. Verifies the stored account matches --account and warns on mismatch.
 *
 * Security:
 *   - The output file holds LIVE session cookies. Treat it like a password:
 *     mount it read-only, keep it out of git, encrypt at rest if stored in a DB.
 *   - Run this from the same egress region/IP the bot will use — a session
 *     captured in one geo and replayed from another is a fingerprint mismatch.
 */

const path = require('path');
const fs = require('fs');

// Reuse the production browser's stealth + launch/context config so the
// captured session is consistent with how the bot presents itself at runtime.
const { buildStealthChromium, buildLaunchOptions, buildContextOptions } = require('./browser');

const LOGIN_POLL_TIMEOUT_MS = 300000; // 5 min — generous window for manual 2FA
const LOGIN_POLL_INTERVAL_MS = 2000;

function printHelp() {
  console.log(`Google Meet Authentication Generator

Usage:
  node generate-auth.js --account <email> --out <path> [--force]

Flags:
  --account <email>   Google account to sign in as (email is pre-filled; you
                      type the password + complete 2FA manually). REQUIRED.
  --out <path>        Output storageState JSON path. REQUIRED.
  --force             Overwrite an existing --out file without prompting.
  --help              Show this help.

Example (single account):
  node generate-auth.js --account notetaker@yourco.com --out /secrets/auth/notetaker@yourco.com.json

Example (account pool — run once per account into a shared dir):
  node generate-auth.js --account bot-a@yourco.com --out /secrets/auth/bot-a@yourco.com.json
  node generate-auth.js --account bot-b@yourco.com --out /secrets/auth/bot-b@yourco.com.json

Then wire the bot:
  export GOOGLE_MEET_USE_AUTH=true
  export GOOGLE_AUTH_STATE_DIR=/secrets/auth     # pool: <DIR>/<sanitized-email>.json
  # per meeting, select the account by setting MEET_NOTETAKER_EMAIL=<email>

Security: the output file holds live session cookies. Mount read-only, keep out
of git, encrypt at rest if stored in a DB. Run from the bot's egress region.`);
}

/**
 * Minimal argv parser for the flags this CLI accepts.
 * @param {string[]} argv
 * @returns {{ account: string|null, out: string|null, force: boolean, help: boolean }}
 */
function parseArgs(argv) {
  const args = { account: null, out: null, force: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') args.help = true;
    else if (a === '--force') args.force = true;
    else if (a === '--account') args.account = argv[++i] || null;
    else if (a === '--out') args.out = argv[++i] || null;
    else if (a.startsWith('--account=')) args.account = a.slice('--account='.length);
    else if (a.startsWith('--out=')) args.out = a.slice('--out='.length);
  }
  return args;
}

/**
 * Read the account email persisted in a storageState file, if any. Google
 * stores the signed-in account hint in cookies; this is best-effort.
 * @param {string} outPath
 * @returns {string|null}
 */
function readStoredAccountHint(outPath) {
  try {
    const raw = JSON.parse(fs.readFileSync(outPath, 'utf8'));
    const cookies = Array.isArray(raw.cookies) ? raw.cookies : [];
    // ACCOUNT_CHOOSER / device cookies don't carry the email, but the
    // logged-in session typically leaves an email hint in localStorage for
    // accounts.google.com. We scan both stores loosely for an email token.
    const origins = Array.isArray(raw.origins) ? raw.origins : [];
    const blob = JSON.stringify({ cookies: cookies.map((c) => c.name), origins });
    const m = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.exec(blob);
    return m ? m[0] : null;
  } catch (_) {
    return null;
  }
}

async function detectLoggedIn(page) {
  return page.evaluate(() => {
    const accountButton = document.querySelector('[aria-label*="Google Account"]');
    const avatar = document.querySelector('img[aria-label*="Google Account"]');
    const newMeetingButton = document.querySelector('button[aria-label*="New meeting"]');
    return !!(accountButton || avatar || newMeetingButton);
  }).catch(() => false);
}

async function generateAuth(account, outPath) {
  console.log('Google Meet Authentication Generator');
  console.log('====================================\n');
  console.log(`[generate-auth] account: ${account}`);
  console.log(`[generate-auth] output:  ${outPath}`);

  // Ensure parent directory exists.
  const outDir = path.dirname(path.resolve(outPath));
  fs.mkdirSync(outDir, { recursive: true });

  // Build the SAME stealth chromium + launch/context options the bot uses, but
  // force headful (2FA needs a visible window).
  const chromium = buildStealthChromium();
  const launchOptions = buildLaunchOptions({ headless: false });
  console.log('[generate-auth] launching headful Chromium (stealth, bot-matched config)...');
  const browser = await chromium.launch(launchOptions);

  let chromeMajor = '141';
  try {
    const ver = await browser.version();
    const m = /(\d+)\./.exec(ver);
    if (m) chromeMajor = m[1];
  } catch (_) { /* default */ }

  const contextOptions = buildContextOptions({ chromeMajor });
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  try {
    console.log('[generate-auth] navigating to Google sign-in...');
    await page.goto('https://accounts.google.com/signin/v2/identifier?service=meet', {
      waitUntil: 'domcontentloaded',
    });

    // Pre-fill ONLY the email (never the password — auto-typing the password
    // is the single biggest bot-detection trip on Google's login flow).
    try {
      await page.waitForSelector('input[type="email"]', { timeout: 10000 });
      await page.fill('input[type="email"]', account);
      console.log('[generate-auth] email pre-filled. Click Next, then enter your password + complete 2FA in the window.');
    } catch (_) {
      console.log('[generate-auth] could not find the email field — sign in manually in the window.');
    }

    console.log('\n[generate-auth] Waiting for a logged-in Meet session (up to 5 min)...');
    console.log('                Complete sign-in (password + 2FA) in the browser window now.\n');

    const deadline = Date.now() + LOGIN_POLL_TIMEOUT_MS;
    let loggedIn = false;
    // Land on Meet first so cookies are set for that domain, then poll.
    while (Date.now() < deadline) {
      const onMeet = /meet\.google\.com/.test(page.url());
      if (onMeet) {
        loggedIn = await detectLoggedIn(page);
        if (loggedIn) break;
      } else {
        // Once the account chooser/2FA clears we expect a Google domain login;
        // nudge to Meet periodically to settle its cookies.
        const onGoogle = /google\.com/.test(page.url());
        if (onGoogle && (await detectLoggedIn(page))) {
          await page.goto('https://meet.google.com/', { waitUntil: 'domcontentloaded' }).catch(() => {});
        }
      }
      await page.waitForTimeout(LOGIN_POLL_INTERVAL_MS);
    }

    if (!loggedIn) {
      // One last navigation + check in case the loop raced the final redirect.
      await page.goto('https://meet.google.com/', { waitUntil: 'domcontentloaded' }).catch(() => {});
      await page.waitForTimeout(2000);
      loggedIn = await detectLoggedIn(page);
    }

    if (!loggedIn) {
      console.log('[generate-auth] WARNING: could not confirm a logged-in session. Saving state anyway — verify before use.');
    } else {
      console.log('[generate-auth] logged-in session detected.');
    }

    console.log(`[generate-auth] saving storageState to ${outPath} ...`);
    await context.storageState({ path: outPath });

    // Verify the captured account matches --account (best-effort hint scan).
    const hint = readStoredAccountHint(outPath);
    if (hint && account && hint.toLowerCase() !== account.toLowerCase()) {
      console.log(`[generate-auth] WARNING: stored session hint (${hint}) does not match --account (${account}). Confirm you signed into the right account.`);
    }

    console.log('\n[generate-auth] DONE.');
    console.log(`  File written: ${path.resolve(outPath)}`);
    console.log('\nWire the bot:');
    console.log('  export GOOGLE_MEET_USE_AUTH=true');
    console.log(`  export GOOGLE_AUTH_STATE_DIR=${outDir}        # pool: <DIR>/<sanitized-email>.json`);
    console.log(`  # or explicit single file: export GOOGLE_AUTH_STATE_PATH=${path.resolve(outPath)}`);
    console.log(`  export MEET_NOTETAKER_EMAIL=${account}        # selects this account per meeting`);
    console.log('\nSecurity:');
    console.log('  - This file holds LIVE session cookies. Mount read-only, keep out of git.');
    console.log('  - Encrypt at rest if stored in a DB. Re-run when the session expires.');
    console.log('  - Capture + run from the same egress region/IP for fingerprint consistency.');
  } finally {
    console.log('\n[generate-auth] closing browser...');
    await browser.close().catch(() => {});
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    process.exit(0);
  }
  if (!args.account || !args.out) {
    console.error('[generate-auth] ERROR: --account and --out are required.\n');
    printHelp();
    process.exit(2);
  }

  const resolvedOut = path.resolve(args.out);
  if (fs.existsSync(resolvedOut) && !args.force) {
    console.error(`[generate-auth] ERROR: ${resolvedOut} already exists. Pass --force to overwrite.`);
    process.exit(2);
  }

  await generateAuth(args.account, resolvedOut);
}

// Only run when invoked directly (so unit tests can require parseArgs etc.).
if (require.main === module) {
  main().catch((err) => {
    console.error(`[generate-auth] fatal: ${err && err.message ? err.message : err}`);
    process.exit(1);
  });
}

module.exports = { parseArgs, readStoredAccountHint, printHelp };
