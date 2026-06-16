#!/usr/bin/env node

/**
 * Diagnostic script to compare local vs production Zoom behavior
 * Run this to understand why production shows Terms page but local doesn't
 */

const { launch } = require('puppeteer-stream');
const path = require('path');

async function diagnoseDifferences() {
  console.log('🔍 ZOOM LOCAL vs PRODUCTION DIAGNOSTIC');
  console.log('=====================================');
  console.log('');
  
  // Current environment detection
  const isProduction = process.env.NODE_ENV === 'production';
  const isDocker = process.env.RUNNING_IN_DOCKER === 'true' || !!process.env.CHROME_BIN;
  const platform = process.platform;
  
  console.log('🔧 Current Environment:');
  console.log(`  NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`);
  console.log(`  RUNNING_IN_DOCKER: ${process.env.RUNNING_IN_DOCKER || 'undefined'}`);
  console.log(`  CHROME_BIN: ${process.env.CHROME_BIN || 'undefined'}`);
  console.log(`  Platform: ${platform}`);
  console.log(`  Detected as Production: ${isProduction}`);
  console.log(`  Detected as Docker: ${isDocker}`);
  console.log('');
  
  // Test with the same meeting URL that failed in production
  const testUrl = process.argv[2] || 'https://gilead.zoom.us/j/94475926595?pwd=IMzQcwBWWv9MQ3DYjA6gzQ5KnJEaz8.1&from=addon';
  
  console.log(`🌐 Testing URL: ${testUrl}`);
  console.log('');
  
  // Browser configuration (matching current Zoom config)
  const getBrowserPath = () => {
    if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
    if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
    if (process.platform === 'darwin') return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    if (process.platform === 'linux') return '/usr/bin/google-chrome';
    return undefined;
  };
  
  const browserArgs = {
    headless: false,
    executablePath: getBrowserPath(),
    userDataDir: `/tmp/chrome-profile-diagnostic-${Date.now()}`,
    timeout: 0,
    ignoreDefaultArgs: ['--enable-automation'],
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox', 
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--window-size=1280,720',
      '--disable-web-security',
      '--disable-blink-features=AutomationControlled',
      '--autoplay-policy=no-user-gesture-required',
      '--allow-running-insecure-content',
      ...(isDocker ? [
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding', 
        '--disable-features=TranslateUI,VizDisplayCompositor',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-default-apps',
      ] : [])
    ],
  };
  
  console.log('🔧 Browser Configuration:');
  console.log(`  Executable: ${browserArgs.executablePath}`);
  console.log(`  Docker args included: ${isDocker}`);
  console.log(`  Total args: ${browserArgs.args.length}`);
  console.log('');
  
  let browser, page;
  
  try {
    console.log('🚀 Launching browser...');
    browser = await launch(browserArgs);
    page = await browser.newPage();
    
    // Set up the same page configuration as production
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 720 });
    
    // Navigate to Zoom meeting
    console.log('🔗 Navigating to Zoom meeting...');
    await page.goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Analyze what we get
    const analysis = await page.evaluate(() => {
      return {
        url: window.location.href,
        title: document.title,
        hasJoinFromBrowser: !!document.querySelector('a[href*="launch"], .join-from-browser, [data-testid="join-from-browser"], a[web_client]'),
        hasTermsLink: !!document.querySelector('a[href*="terms"], a[href*="legal"]'),
        hasDownloadLink: !!document.querySelector('a[href*="download"]'),
        bodyText: document.body.textContent.substring(0, 500),
        allLinks: Array.from(document.querySelectorAll('a')).map(a => ({
          href: a.href,
          text: a.textContent.trim().substring(0, 100)
        })).slice(0, 10)
      };
    });
    
    console.log('📊 ANALYSIS RESULTS:');
    console.log('====================');
    console.log(`Current URL: ${analysis.url}`);
    console.log(`Page Title: ${analysis.title}`);
    console.log(`Has "Join from browser": ${analysis.hasJoinFromBrowser}`);
    console.log(`Has Terms link: ${analysis.hasTermsLink}`);
    console.log(`Has Download link: ${analysis.hasDownloadLink}`);
    console.log('');
    
    console.log('🔗 First 10 links found:');
    analysis.allLinks.forEach((link, i) => {
      console.log(`  ${i+1}. ${link.text} → ${link.href}`);
    });
    console.log('');
    
    console.log('📄 Body text preview:');
    console.log(analysis.bodyText);
    console.log('');
    
    // Key differences to look for
    console.log('🎯 KEY DIAGNOSTIC QUESTIONS:');
    console.log('============================');
    
    if (analysis.url.includes('terms') || analysis.url.includes('legal')) {
      console.log('❌ ISSUE CONFIRMED: Already redirected to Terms page!');
      console.log('   This means the initial page load itself redirects to Terms');
      console.log('   Likely causes: Corporate Zoom policy, IP geolocation, browser fingerprint');
    } else if (analysis.hasJoinFromBrowser) {
      console.log('✅ GOOD: Found "Join from browser" button');
      console.log('   Your local environment gets the normal meeting page');
    } else {
      console.log('⚠️  UNUSUAL: No "Join from browser" button found');
      console.log('   This page variant is different from expected');
    }
    
    if (analysis.hasTermsLink && analysis.hasJoinFromBrowser) {
      console.log('⚠️  RISKY: Both Terms link AND Join button present');
      console.log('   Easy to click wrong one - explains production issue');
    }
    
    console.log('');
    console.log('💡 RECOMMENDATIONS:');
    console.log('===================');
    
    if (isDocker !== (process.env.NODE_ENV === 'production')) {
      console.log('1. Set NODE_ENV=production locally to test production behavior');
      console.log('   NODE_ENV=production npm run test');
    }
    
    if (!isDocker && process.env.NODE_ENV === 'production') {
      console.log('2. Set RUNNING_IN_DOCKER=true to test Docker browser args');
      console.log('   RUNNING_IN_DOCKER=true npm run test');
    }
    
    console.log('3. Try using your production server IP/location via VPN');
    console.log('4. Clear all Zoom cookies/localStorage before testing');
    console.log('5. Test with a fresh browser profile (no Zoom history)');
    
    // Keep browser open for manual inspection
    console.log('');
    console.log('🔍 Browser will stay open for 30 seconds for manual inspection...');
    await new Promise(resolve => setTimeout(resolve, 30000));
    
  } catch (error) {
    console.error('❌ Error during diagnostic:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run diagnostic
diagnoseDifferences().catch(console.error);
