import { test, expect } from "@playwright/test";

test.describe("auto-join preferences", () => {
  test("configures and saves auto-join preferences", async ({ page }) => {
    await page.goto("/settings/capture");
    await expect(page.getByRole("heading", { name: /auto-join & capture/i })).toBeVisible();

    // Toggle the Zoom auto-join off, then save.
    await page.getByRole("switch", { name: /join zoom/i }).click();
    await page.getByRole("button", { name: /save auto-join preferences/i }).click();
    await expect(page.getByText(/^Saved\.$/)).toBeVisible();
  });

  test("settings page links to auto-join & capture", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("link", { name: /manage auto-join & capture/i })).toBeVisible();
  });
});
