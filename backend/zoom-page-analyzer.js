#!/usr/bin/env node

const puppeteer = require('puppeteer');

async function analyzeZoomPageElements() {
  console.log('🔍 Analyzing Zoom page elements after "Join from browser" click...');
  
  let browser, page;
  
  try {
    // Launch browser with same configuration as bot
    browser = await puppeteer.launch({
      headless: false,
      devtools: false,
      defaultViewport: null,
      ignoreDefaultArgs: ['--disable-extensions'],
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
        '--window-size=1920,1080'
      ]
    });

    page = await browser.newPage();
    
    // Navigate to the meeting URL (using production meeting ID from logs)
    const meetingUrl = 'https://gilead.zoom.us/j/94475926595?pwd=IMzQcwBWWv9MQ3DYjA6gzQ5KnJEaz8.1&from=addon';
    console.log(`📍 Navigating to: ${meetingUrl}`);
    
    await page.goto(meetingUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log(`🌐 Current URL: ${await page.url()}`);
    console.log(`📄 Page Title: ${await page.title()}`);
    
    // Analyze all clickable elements on the page
    const analysis = await page.evaluate(() => {
      // Get all clickable elements
      const clickableSelectors = [
        'a', 'button', '[role="button"]', 
        '[onclick]', 'div[onclick]', 'span[onclick]',
        '.launch', '.join', '.browser',
        '[web_client]', '[data-testid*="join"]'
      ];
      
      const allElements = [];
      const clickableElements = [];
      
      // Collect all elements
      document.querySelectorAll('*').forEach(el => {
        if (el.textContent && el.textContent.trim()) {
          allElements.push({
            tagName: el.tagName,
            textContent: el.textContent.trim().substring(0, 100),
            className: el.className || '',
            id: el.id || '',
            href: el.href || '',
            role: el.getAttribute('role') || '',
            onClick: el.onclick ? 'has-onclick' : '',
            webClient: el.hasAttribute('web_client') ? 'true' : '',
            dataTestId: el.getAttribute('data-testid') || ''
          });
        }
      });
      
      // Collect specifically clickable elements
      clickableSelectors.forEach(selector => {
        try {
          document.querySelectorAll(selector).forEach(el => {
            clickableElements.push({
              selector: selector,
              tagName: el.tagName,
              textContent: el.textContent.trim().substring(0, 100),
              className: el.className || '',
              id: el.id || '',
              href: el.href || '',
              role: el.getAttribute('role') || '',
              webClient: el.hasAttribute('web_client') ? 'true' : '',
              dataTestId: el.getAttribute('data-testid') || ''
            });
          });
        } catch (e) {
          // Skip invalid selectors
        }
      });
      
      // Look specifically for text patterns we're interested in
      const textPatterns = [
        'join from your browser',
        'join from browser',
        'launch meeting',
        'terms of service',
        'privacy statement',
        'open zoom',
        'download'
      ];
      
      const textMatches = [];
      textPatterns.forEach(pattern => {
        document.querySelectorAll('*').forEach(el => {
          if (el.textContent && el.textContent.toLowerCase().includes(pattern)) {
            textMatches.push({
              pattern: pattern,
              tagName: el.tagName,
              textContent: el.textContent.trim().substring(0, 100),
              className: el.className || '',
              id: el.id || '',
              href: el.href || '',
              role: el.getAttribute('role') || '',
              webClient: el.hasAttribute('web_client') ? 'true' : ''
            });
          }
        });
      });
      
      return {
        url: window.location.href,
        title: document.title,
        totalElements: allElements.length,
        clickableElements: clickableElements,
        textMatches: textMatches,
        allElementsSample: allElements.slice(0, 20) // First 20 elements
      };
    });
    
    console.log('\n📊 ANALYSIS RESULTS:');
    console.log('====================');
    console.log(`URL: ${analysis.url}`);
    console.log(`Title: ${analysis.title}`);
    console.log(`Total elements: ${analysis.totalElements}`);
    console.log(`Clickable elements found: ${analysis.clickableElements.length}`);
    console.log(`Text matches found: ${analysis.textMatches.length}`);
    
    console.log('\n🎯 TEXT PATTERN MATCHES:');
    analysis.textMatches.forEach((match, index) => {
      console.log(`${index + 1}. Pattern: "${match.pattern}"`);
      console.log(`   Tag: ${match.tagName}`);
      console.log(`   Text: "${match.textContent}"`);
      console.log(`   Class: "${match.className}"`);
      console.log(`   ID: "${match.id}"`);
      console.log(`   Href: "${match.href}"`);
      console.log(`   Role: "${match.role}"`);
      console.log(`   WebClient: "${match.webClient}"`);
      console.log('   ---');
    });
    
    console.log('\n🔗 CLICKABLE ELEMENTS:');
    analysis.clickableElements.forEach((el, index) => {
      console.log(`${index + 1}. Selector: ${el.selector}`);
      console.log(`   Tag: ${el.tagName}`);
      console.log(`   Text: "${el.textContent}"`);
      console.log(`   Class: "${el.className}"`);
      console.log(`   ID: "${el.id}"`);
      console.log(`   Href: "${el.href}"`);
      console.log(`   WebClient: "${el.webClient}"`);
      console.log('   ---');
    });
    
    console.log('\n📝 SAMPLE ELEMENTS:');
    analysis.allElementsSample.forEach((el, index) => {
      console.log(`${index + 1}. ${el.tagName}: "${el.textContent}"`);
    });
    
    // Wait for manual inspection
    console.log('\n⏳ Waiting 30 seconds for manual inspection...');
    await new Promise(resolve => setTimeout(resolve, 30000));
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the analysis
analyzeZoomPageElements().catch(console.error);
