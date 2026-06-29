import { test, expect } from "@playwright/test";
import { loadSeeded } from "./helpers/seeded";

test.describe("topic trackers", () => {
  test("create a tracker, re-summarize a meeting, and see a hit", async ({ page }) => {
    test.setTimeout(60_000);
    // 1. Create a tracker matching seeded transcript content ("billing").
    await page.goto("/trackers");
    await expect(page.getByRole("heading", { name: "Trackers" })).toBeVisible();
    await page.getByPlaceholder(/tracker name/i).fill("Billing watch");
    await page.getByPlaceholder(/keywords/i).fill("billing");
    await page.getByRole("button", { name: /create tracker/i }).click();
    await expect(page.getByText("Billing watch")).toBeVisible();

    // 2. Re-summarize the Q3 Billing meeting -> fires the tracker scan.
    const { meetings } = loadSeeded();
    await page.goto(`/meetings/${meetings[0].id}`);
    await page.getByRole("button", { name: /regenerate/i }).click();
    // Wait for the regenerate round-trip to settle.
    await page.waitForTimeout(2500);

    // 3. The hit shows up on the trackers page.
    await page.goto("/trackers");
    await expect(page.getByText(/billing/i).first()).toBeVisible();
    await expect(page.getByText(/Recent hits/i)).toBeVisible();
    await expect(page.locator("text=Billing watch").first()).toBeVisible();
  });
});
