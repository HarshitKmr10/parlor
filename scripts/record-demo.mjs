#!/usr/bin/env node
// Records a real product walkthrough video against a running Parlor
// instance: seeds a meeting via the backend API (the same contract
// desktop-capture uses -- there is currently no botless-creation path
// through the web UI itself), then drives the actual UI with Playwright:
// login, dashboard, meeting summary, and the cross-meeting Ask page with a
// cited answer. Produces docs/demo/product-walkthrough.{mp4,gif}.
//
// Usage:
//   cd web && node ../scripts/record-demo.mjs
//   DEMO_BACKEND_URL=http://localhost:8001 DEMO_WEB_URL=http://localhost:3001 \
//     node ../scripts/record-demo.mjs   # against a local stack instead
//
// Requires @playwright/test + its chromium binary installed in web/
// (already a dev dependency for the e2e suite) and ffmpeg on PATH for the
// mp4/gif conversion step.

import { chromium } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { execSync } from "node:child_process";
import { mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const BACKEND = process.env.DEMO_BACKEND_URL ?? "https://parlor-demo-backend-316016512837.us-central1.run.app";
const WEB = process.env.DEMO_WEB_URL ?? "https://parlor-demo-web-316016512837.us-central1.run.app";
const RAW_DIR = path.join(REPO_ROOT, "scripts", ".demo-video-tmp");
const OUT_DIR = path.join(REPO_ROOT, "docs", "demo");

async function main() {
  const email = `demo-${Date.now()}@example.com`;
  const password = "DemoWalkthrough123!";

  console.log("1. Seeding a real meeting via the backend API...");
  const signupRes = await fetch(`${BACKEND}/api/v1/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name: "Jordan", workspaceName: "Acme Product Team" }),
  });
  if (!signupRes.ok) throw new Error(`signup failed: ${signupRes.status} ${await signupRes.text()}`);
  const auth = await signupRes.json();
  const headers = {
    Authorization: `Bearer ${auth.accessToken}`,
    "X-Workspace-Id": auth.workspace.id,
    "Content-Type": "application/json",
  };

  const meetingRes = await fetch(`${BACKEND}/api/v1/meetings/botless`, {
    method: "POST",
    headers,
    body: JSON.stringify({ title: "Q3 pricing planning", source: "desktop" }),
  });
  if (!meetingRes.ok) throw new Error(`meeting create failed: ${meetingRes.status} ${await meetingRes.text()}`);
  const meeting = await meetingRes.json();

  const lines = [
    { speakerName: "Jordan", text: "Let's finalize the Q3 pricing tiers before the launch.", tStartSec: 0, tEndSec: 4 },
    { speakerName: "Priya", text: "I think a free self-hosted tier plus a hosted pro tier at $20 a month makes sense.", tStartSec: 4, tEndSec: 10 },
    { speakerName: "Jordan", text: "Agreed. Can you own drafting the pricing page copy by Friday?", tStartSec: 10, tEndSec: 14 },
    { speakerName: "Priya", text: "Yes, I'll have a draft ready by Friday.", tStartSec: 14, tEndSec: 17 },
  ];
  const segments = lines.map((s, i) => ({
    id: randomUUID(),
    speakerId: null,
    ...s,
    createdAt: new Date(Date.now() + i * 1000).toISOString(),
  }));

  const transcriptRes = await fetch(`${BACKEND}/api/v1/meetings/${meeting.id}/transcript`, {
    method: "POST",
    headers,
    body: JSON.stringify({ segments }),
  });
  if (!transcriptRes.ok) throw new Error(`transcript failed: ${transcriptRes.status} ${await transcriptRes.text()}`);

  const completeRes = await fetch(`${BACKEND}/api/v1/meetings/${meeting.id}/complete`, { method: "POST", headers });
  if (!completeRes.ok) throw new Error(`complete failed: ${completeRes.status} ${await completeRes.text()}`);

  const summarizeRes = await fetch(`${BACKEND}/api/v1/meetings/${meeting.id}/summarize`, { method: "POST", headers });
  if (!summarizeRes.ok) throw new Error(`summarize failed: ${summarizeRes.status} ${await summarizeRes.text()}`);
  console.log("   seeded meeting:", meeting.id);

  console.log("2. Recording the real product walkthrough...");
  mkdirSync(RAW_DIR, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: RAW_DIR, size: { width: 1280, height: 800 } },
  });
  const page = await context.newPage();

  await page.goto(`${WEB}/login`);
  await page.getByLabel(/^email$/i).fill(email);
  await page.getByLabel(/^password$/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/dashboard/, { timeout: 15000 });
  await page.waitForTimeout(1500);

  await page.getByText("Q3 pricing planning").first().click();
  await page.waitForTimeout(2000);

  const summaryTab = page.getByRole("tab", { name: /summary/i });
  if (await summaryTab.isVisible().catch(() => false)) {
    await summaryTab.click();
  }
  await page.waitForTimeout(3000);

  await page.goto(`${WEB}/ask`);
  await page.waitForTimeout(1000);
  await page.getByPlaceholder(/ask across every meeting/i).fill("Who is drafting the pricing page copy, and by when?");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(5000);

  await context.close();
  await browser.close();

  console.log("3. Converting to mp4/gif...");
  mkdirSync(OUT_DIR, { recursive: true });
  const webm = readdirSync(RAW_DIR).find((f) => f.endsWith(".webm"));
  const webmPath = path.join(RAW_DIR, webm);
  const mp4Path = path.join(OUT_DIR, "product-walkthrough.mp4");
  const gifPath = path.join(OUT_DIR, "product-walkthrough.gif");

  execSync(`ffmpeg -y -i "${webmPath}" -c:v libx264 -pix_fmt yuv420p -crf 20 -preset slow "${mp4Path}"`, { stdio: "inherit" });
  execSync(
    `ffmpeg -y -i "${webmPath}" -vf "fps=12,scale=960:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" "${gifPath}"`,
    { stdio: "inherit" },
  );

  rmSync(RAW_DIR, { recursive: true, force: true });
  console.log("Done:", mp4Path, gifPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
