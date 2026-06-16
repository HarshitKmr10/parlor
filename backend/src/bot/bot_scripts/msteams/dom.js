'use strict';

// Small DOM helpers built on Playwright. Two design rules:
//   1. Never block on a single selector — always race a list of candidates
//      against an abort signal.
//   2. Never use unconditional sleeps; if you need to wait, wait on an
//      observable signal (selector, event, predicate) with a deadline.

const DEFAULT_INTERVAL_MS = 120;

async function raceAny(page, candidates, { timeoutMs = 4_000, intervalMs = DEFAULT_INTERVAL_MS } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const selector of candidates) {
      const handle = await page.$(selector).catch(() => null);
      if (handle) {
        const visible = await handle.isVisible().catch(() => false);
        if (visible) return { selector, handle };
        await handle.dispose().catch(() => {});
      }
    }
    await sleep(intervalMs);
  }
  return null;
}

async function raceFirst(page, groups, { timeoutMs = 4_000, intervalMs = DEFAULT_INTERVAL_MS } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const [key, candidates] of Object.entries(groups)) {
      for (const selector of candidates) {
        const handle = await page.$(selector).catch(() => null);
        if (!handle) continue;
        const visible = await handle.isVisible().catch(() => false);
        if (visible) return { key, selector, handle };
        await handle.dispose().catch(() => {});
      }
    }
    await sleep(intervalMs);
  }
  return null;
}

// Click strategy:
//   1. Playwright synthesises a mouse click via CDP. In headless mode,
//      Teams' web client (specifically the "Continue on this browser"
//      launcher button) checks something on the event and silently
//      ignores synthesised clicks — the page never navigates.
//   2. A plain JS `element.click()` is accepted by Teams and triggers
//      the underlying React handler.
// We fire BOTH unconditionally and idempotently. Whichever takes effect
// first wins; the second is a no-op for any button-like element.
async function clickAny(page, candidates, opts) {
  const found = await raceAny(page, candidates, opts);
  if (!found) return false;
  try {
    // Tight timeout: default Playwright actionability wait is 30 s. With
    // a 5 s cap and a JS-click fallback right after, we give up fast and
    // fall back to scripted click instead of stalling the whole join.
    await found.handle.click({ delay: 30, timeout: 5_000 }).catch(() => {});
    await found.handle.evaluate((el) => { try { el.click(); } catch (_) {} }).catch(() => {});
    return true;
  } finally {
    await found.handle.dispose().catch(() => {});
  }
}

// Fill strategy mirrors the click strategy — Playwright's synthetic input
// is silently dropped by React's controlled-component value tracker. Set
// the value through the prototype's native setter (which React reads from)
// and dispatch a real `input` event so React's onChange fires.
async function fillAny(page, candidates, value, opts) {
  const found = await raceAny(page, candidates, opts);
  if (!found) return false;
  try {
    await found.handle.fill('').catch(() => {});
    await found.handle.type(value, { delay: 15 }).catch(() => {});
    // React-compatible value injection. Uses the prototype setter so
    // React's input value tracker (which monkey-patches the instance
    // setter) sees the change and fires onChange/onInput. Without this,
    // synthetic Playwright input gets swallowed and the field appears
    // empty even though .fill()/.type() reported success.
    await found.handle.evaluate((el, v) => {
      try {
        const proto = el.tagName === 'TEXTAREA'
          ? window.HTMLTextAreaElement.prototype
          : window.HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
        el.focus();
        setter.call(el, v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (_e) { /* ignore */ }
    }, value).catch(() => {});
    return true;
  } finally {
    await found.handle.dispose().catch(() => {});
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { raceAny, raceFirst, clickAny, fillAny, sleep };
