import { test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { loadSeeded } from "./helpers/seeded";

/**
 * Not an assertion suite — captures full-page screenshots of every key surface
 * at desktop + mobile widths for visual review. Run with:
 *   playwright test screenshots.spec.ts --project=chromium
 */
const DIR = "e2e/.artifacts/shots";
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

test.describe("visual capture", () => {
  for (const vp of VIEWPORTS) {
    test(`capture ${vp.name}`, async ({ page }) => {
      test.setTimeout(90_000);
      mkdirSync(DIR, { recursive: true });
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const { meetings } = loadSeeded();
      const m = meetings[0];

      const shots: [string, string][] = [
        ["dashboard", "/dashboard"],
        ["meetings", "/meetings"],
        ["meeting-summary", `/meetings/${m.id}`],
        ["meeting-analytics", `/meetings/${m.id}#analytics`],
        ["meeting-highlights", `/meetings/${m.id}#highlights`],
        ["meeting-comments", `/meetings/${m.id}#comments`],
        ["search", "/search?q=billing"],
        ["highlights-reel", "/highlights"],
        ["action-items", "/action-items"],
        ["reports", "/reports"],
        ["settings", "/settings"],
        ["templates", "/settings/templates"],
        ["webhooks", "/settings/webhooks"],
      ];

      for (const [name, path] of shots) {
        await page.goto(path);
        // For hash-tab pages, click the tab so the right panel is shown.
        const hash = path.split("#")[1];
        if (hash) {
          await page.getByRole("tab", { name: new RegExp(hash, "i") }).click().catch(() => {});
        }
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${DIR}/${vp.name}-${name}.png`, fullPage: true });
      }
    });
  }
});
