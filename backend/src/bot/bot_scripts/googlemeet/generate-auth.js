/**
 * Google Meet Authentication Generator
 *
 * This script generates an auth.json file containing a logged-in Google session.
 * Run this once manually to create the authentication state that the bot will use.
 *
 * Usage:
 *   # Set environment variables (or enter manually when prompted)
 *   export GOOGLE_ACCOUNT_USER="your-bot@gmail.com"
 *   export GOOGLE_ACCOUNT_PASSWORD="your-password"
 *
 *   # Run the script
 *   node generate-auth.js
 *
 * The script will:
 * 1. Open a browser window
 * 2. Navigate to Google sign-in
 * 3. Attempt to log in (or wait for manual login if 2FA is required)
 * 4. Save the authenticated session to auth.json
 *
 * After running, the auth.json file can be used by the bot to join meetings
 * as an authenticated user, which:
 * - Removes the "may not be who they claim to be" warning
 * - Allows joining meetings that require Google sign-in
 * - Can bypass waiting room if invited to the calendar event
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const AUTH_FILE = path.join(__dirname, 'auth.json');

async function generateAuth() {
  console.log('🔐 Google Meet Authentication Generator');
  console.log('=====================================\n');

  const email = process.env.GOOGLE_ACCOUNT_USER;
  const password = process.env.GOOGLE_ACCOUNT_PASSWORD;

  if (!email) {
    console.log('⚠️  GOOGLE_ACCOUNT_USER not set - you will need to enter credentials manually');
  }

  // Launch browser in headed mode so user can see and interact if needed
  console.log('🚀 Launching browser...');
  const browser = await chromium.launch({
    headless: false, // Must be headed for manual interaction
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();

  try {
    // Navigate to Google sign-in
    console.log('📍 Navigating to Google sign-in...');
    await page.goto('https://accounts.google.com/signin/v2/identifier?service=meet', {
      waitUntil: 'networkidle',
    });

    // Try automatic login if credentials provided
    if (email && password) {
      console.log('🔑 Attempting automatic login...');

      // Enter email
      try {
        await page.waitForSelector('input[type="email"]', { timeout: 10000 });
        await page.fill('input[type="email"]', email);
        await page.click('#identifierNext');
        await page.waitForTimeout(2000);
      } catch (e) {
        console.log('⚠️  Could not find email field - may already be on password step');
      }

      // Enter password
      try {
        await page.waitForSelector('input[type="password"]', { timeout: 10000 });
        await page.fill('input[type="password"]', password);
        await page.click('#passwordNext');
        await page.waitForTimeout(3000);
      } catch (e) {
        console.log('⚠️  Could not find password field');
      }
    } else {
      console.log('\n📝 Please sign in manually in the browser window...');
    }

    // Wait for successful authentication
    // This is indicated by reaching meet.google.com or seeing the user avatar
    console.log('\n⏳ Waiting for successful authentication...');
    console.log('   (If 2FA is required, please complete it in the browser)\n');

    // Wait for either Meet homepage or the account avatar
    await Promise.race([
      page.waitForURL('**/meet.google.com/**', { timeout: 120000 }),
      page.waitForSelector('[aria-label*="Google Account"]', { timeout: 120000 }),
      page.waitForSelector('a[href*="accounts.google.com"][aria-label*="Account"]', { timeout: 120000 }),
    ]).catch(() => {
      // If none match, check if we're on a Google page with the user logged in
    });

    // Verify we're logged in by checking for account indicator
    await page.waitForTimeout(2000);

    // Navigate to Meet to ensure cookies are set for that domain
    await page.goto('https://meet.google.com/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Check if we see indicators of being logged in
    const loggedIn = await page.evaluate(() => {
      // Look for signs of being logged in
      const accountButton = document.querySelector('[aria-label*="Google Account"]');
      const avatar = document.querySelector('img[aria-label*="Google Account"]');
      const newMeetingButton = document.querySelector('button[aria-label*="New meeting"]');
      return !!(accountButton || avatar || newMeetingButton);
    });

    if (!loggedIn) {
      console.log('⚠️  Could not verify login status. Saving state anyway...');
    } else {
      console.log('✅ Successfully logged in!');
    }

    // Save the authentication state
    console.log(`\n💾 Saving authentication state to ${AUTH_FILE}...`);
    await context.storageState({ path: AUTH_FILE });

    console.log('\n✅ Authentication file generated successfully!');
    console.log(`   File: ${AUTH_FILE}`);
    console.log('\n📋 Next steps:');
    console.log('   1. The bot will now use this auth file for authenticated sessions');
    console.log('   2. Set GOOGLE_MEET_USE_AUTH=true in your environment');
    console.log('   3. The bot will join meetings as an authenticated user');
    console.log('\n⚠️  Security notes:');
    console.log('   - Keep auth.json secure (it contains session cookies)');
    console.log('   - Add auth.json to .gitignore');
    console.log('   - Re-run this script if authentication expires');

  } catch (error) {
    console.error('\n❌ Error during authentication:', error.message);
    console.log('\nTrying to save current state anyway...');

    try {
      await context.storageState({ path: AUTH_FILE });
      console.log('💾 State saved (may be incomplete)');
    } catch (saveError) {
      console.error('Could not save state:', saveError.message);
    }
  } finally {
    console.log('\n🔒 Closing browser...');
    await browser.close();
  }
}

// Check if auth.json already exists
if (fs.existsSync(AUTH_FILE)) {
  console.log(`⚠️  ${AUTH_FILE} already exists.`);
  console.log('   Delete it first if you want to regenerate.\n');

  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question('Overwrite existing auth.json? (y/N): ', async (answer) => {
    rl.close();
    if (answer.toLowerCase() === 'y') {
      await generateAuth();
    } else {
      console.log('Cancelled.');
      process.exit(0);
    }
  });
} else {
  generateAuth().catch(console.error);
}
