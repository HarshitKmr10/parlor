'use strict';

/**
 * Humanized input orchestrator for the Google Meet join flow.
 *
 * Drives the real X server (via the `humanclick` Rust CLI, XTEST) instead of
 * Playwright/CDP's synthetic input dispatch, so the page observes genuine
 * `isTrusted: true` pointer/keyboard events. This module owns:
 *   1. Calibration — deriving the page-client(CSS px) <-> X-screen(device px)
 *      mapping by moving the real pointer to probe points and reading back
 *      the resulting mousemove event.
 *   2. Endpoint verification — after a move, re-reading the LIVE element rect
 *      and the REAL pointer position and confirming (via elementFromPoint)
 *      that the pointer is actually on the target before clicking. A miss
 *      triggers bounded recalibration + a corrective absolute move, never a
 *      blind click.
 *   3. Delegating the trajectory synthesis and XTEST calls themselves to the
 *      `humanclick` binary (see backend/src/bot/humanclick).
 *
 * Falls back to null (caller uses plain Playwright clicks) when the binary
 * or the X display isn't reachable — mirrors this codebase's existing
 * bot_runtime_unavailable-style graceful degrade rather than crashing the join.
 */

const { execFile } = require('node:child_process');
const path = require('node:path');

const ENDPOINT_SLACK_PX = 2;
const MAX_CORRECTIONS = 4;
const CLI_TIMEOUT_MS = 15000;

function binaryPath() {
  return (
    process.env.HUMANCLICK_BIN ||
    path.join(__dirname, '..', '..', 'humanclick', 'target', 'release', 'humanclick')
  );
}

function runHumanclick(args) {
  const display = process.env.DISPLAY || ':99';
  return new Promise((resolve, reject) => {
    execFile(
      binaryPath(),
      ['--display', display, ...args],
      { timeout: CLI_TIMEOUT_MS },
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error(`humanclick ${args[0]} failed: ${(stderr || err.message).trim()}`));
          return;
        }
        try {
          resolve(JSON.parse(stdout));
        } catch (_parseErr) {
          reject(new Error(`humanclick ${args[0]} returned non-JSON output: ${stdout}`));
        }
      }
    );
  });
}

async function isHumanclickAvailable() {
  try {
    const result = await runHumanclick(['available']);
    return result.available === true;
  } catch (_err) {
    return false;
  }
}

class HumanizedSession {
  constructor(page, opts = {}) {
    this.page = page;
    this.log = opts.log || (() => {});
    this.onMissScreenshot = opts.onMissScreenshot || null;
    this.offsetX = 0;
    this.offsetY = 0;
    this.dpr = 1;
    this.calibrated = false;
  }

  /**
   * Derive the page-client <-> X-screen coordinate mapping by moving the
   * real pointer to two probe points and reading back the resulting
   * mousemove event's clientX/Y. Re-run (force=true) whenever a click lands
   * off-target, since layout/DPR/window-position drift invalidates it.
   */
  async calibrate(force = false) {
    if (this.calibrated && !force) return;
    this.dpr = await this.page.evaluate(() => window.devicePixelRatio || 1);

    await this.page.evaluate(() => {
      window.__humanclickLastMouse = null;
      window.addEventListener(
        'mousemove',
        (e) => {
          window.__humanclickLastMouse = { clientX: e.clientX, clientY: e.clientY };
        },
        { capture: true }
      );
    });

    const geo = await this.page.evaluate(() => ({
      sx: window.screenX,
      sy: window.screenY,
      iw: window.innerWidth,
      ih: window.innerHeight,
    }));

    const probes = [
      { x: Math.round((geo.sx + geo.iw * 0.35) * this.dpr), y: Math.round((geo.sy + geo.ih * 0.4) * this.dpr) },
      { x: Math.round((geo.sx + geo.iw * 0.6) * this.dpr), y: Math.round((geo.sy + geo.ih * 0.6) * this.dpr) },
    ];

    let sample = null;
    for (const p of probes) {
      await runHumanclick(['move-abs', '--x', String(p.x), '--y', String(p.y)]);
      await this.page.waitForTimeout(120);
      const ev = await this.page.evaluate(() => window.__humanclickLastMouse);
      if (ev) {
        sample = { sx: p.x, sy: p.y, cx: ev.clientX, cy: ev.clientY };
        break;
      }
    }

    if (sample) {
      this.offsetX = sample.sx - sample.cx * this.dpr;
      this.offsetY = sample.sy - sample.cy * this.dpr;
      this.log(`humanized: calibrated offset=(${this.offsetX.toFixed(0)},${this.offsetY.toFixed(0)}) dpr=${this.dpr}`);
    } else {
      this.offsetX = geo.sx * this.dpr;
      this.offsetY = geo.sy * this.dpr;
      this.log('humanized: calibration fell back to screenX/Y formula (no mousemove observed)');
    }
    this.calibrated = true;
  }

  async metricsOf(handle) {
    return this.page.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height };
    }, handle);
  }

  rectDevicePx(m) {
    return {
      left: this.offsetX + m.left * this.dpr,
      top: this.offsetY + m.top * this.dpr,
      right: this.offsetX + (m.left + m.width) * this.dpr,
      bottom: this.offsetY + (m.top + m.height) * this.dpr,
    };
  }

  screenToPage(sx, sy) {
    return { x: (sx - this.offsetX) / this.dpr, y: (sy - this.offsetY) / this.dpr };
  }

  pageToScreen(px, py) {
    return { x: this.offsetX + px * this.dpr, y: this.offsetY + py * this.dpr };
  }

  /**
   * Read the REAL hardware pointer and the LIVE element rect, and confirm
   * the pointer is both geometrically inside the rect and that
   * elementFromPoint at the mapped page coords resolves to the target.
   */
  async pointerHitsTarget(handle) {
    const m = await this.metricsOf(handle);
    const pointer = await runHumanclick(['pointer']);
    const { x: pageX, y: pageY } = this.screenToPage(pointer.x, pointer.y);
    const insideRect =
      pageX >= m.left - ENDPOINT_SLACK_PX &&
      pageX <= m.left + m.width + ENDPOINT_SLACK_PX &&
      pageY >= m.top - ENDPOINT_SLACK_PX &&
      pageY <= m.top + m.height + ENDPOINT_SLACK_PX;
    if (!insideRect) return { ok: false, m, pageX, pageY };

    const onTarget = await this.page.evaluate(
      ([px, py, el]) => {
        const hit = document.elementFromPoint(px, py);
        return !!hit && (hit === el || el.contains(hit) || hit.contains(el));
      },
      [pageX, pageY, handle]
    );
    return { ok: onTarget, m, pageX, pageY };
  }

  /** Move the real pointer to `handle` along a synthesized human trajectory, then click it. */
  async navigateAndClick(handle) {
    await this.calibrate();
    // Let layout settle before reading the rect — a rect read mid-render is
    // the main source of a stale-geometry miss.
    await this.page.waitForTimeout(120);
    const m = await this.metricsOf(handle);
    if (m.width <= 0 || m.height <= 0) {
      throw new Error('humanized: target element has zero size');
    }
    const rect = this.rectDevicePx(m);

    await runHumanclick([
      'move',
      '--to-left', String(rect.left),
      '--to-top', String(rect.top),
      '--to-right', String(rect.right),
      '--to-bottom', String(rect.bottom),
    ]);

    let hit = await this.pointerHitsTarget(handle);
    for (let i = 0; !hit.ok && i < MAX_CORRECTIONS; i++) {
      this.log(
        `humanized: endpoint miss #${i + 1} — pointer page=(${hit.pageX.toFixed(0)},${hit.pageY.toFixed(0)}) ` +
        `rect=[${hit.m.left.toFixed(0)},${hit.m.top.toFixed(0)} ${hit.m.width.toFixed(0)}x${hit.m.height.toFixed(0)}]; recalibrating`
      );
      await this.calibrate(true);
      const cx = hit.m.left + hit.m.width / 2;
      const cy = hit.m.top + hit.m.height / 2;
      const target = this.pageToScreen(cx, cy);
      await runHumanclick(['move-abs', '--x', String(Math.round(target.x)), '--y', String(Math.round(target.y))]);
      await this.page.waitForTimeout(60);
      hit = await this.pointerHitsTarget(handle);
    }

    if (!hit.ok) {
      const reason = `humanized: click verification failed after ${MAX_CORRECTIONS} corrections — refusing to click off-target`;
      this.log(reason);
      if (this.onMissScreenshot) {
        try {
          await this.onMissScreenshot(this.page, reason);
        } catch (_shotErr) {
          // Screenshot is best-effort diagnostics; never let it mask the real failure.
        }
      }
      throw new Error(reason);
    }

    await runHumanclick(['click']);
  }

  async fillField(handle, text) {
    await this.navigateAndClick(handle);
    // Select any pre-existing content so the upcoming real keystrokes
    // overwrite it rather than append (harmless DOM-selection state change,
    // not a synthetic input event).
    await handle.evaluate((el) => {
      if (typeof el.select === 'function') el.select();
    }).catch(() => {});
    await this.page.waitForTimeout(120 + Math.floor(Math.random() * 180));
    await runHumanclick(['type', '--text', text]);
  }
}

/**
 * Build {clickHandle, fillField} backed by real XTEST input, or null if the
 * humanclick binary / X display isn't usable right now.
 */
async function createHumanizedHelpers(page, opts = {}) {
  const available = await isHumanclickAvailable();
  if (!available) return null;

  const session = new HumanizedSession(page, opts);
  return {
    clickHandle: async (handle, _label) => session.navigateAndClick(handle),
    fillField: async (handle, _selector, text, _label) => session.fillField(handle, text),
  };
}

module.exports = { createHumanizedHelpers, isHumanclickAvailable, HumanizedSession };
