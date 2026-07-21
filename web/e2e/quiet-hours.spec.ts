import { test, expect } from "@playwright/test";

test.describe("notification quiet hours", () => {
  test("configures and saves quiet hours", async ({ page }) => {
    await page.goto("/settings/quiet-hours");
    await expect(page.getByRole("heading", { name: /quiet hours/i })).toBeVisible();

    // Enable quiet hours, then save.
    await page.getByRole("switch", { name: /enable quiet hours/i }).click();
    await page.getByRole("button", { name: /save quiet hours/i }).click();
    await expect(page.getByText(/^Saved\.$/)).toBeVisible();
  });

  test("settings page links to quiet hours", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("link", { name: /manage quiet hours/i })).toBeVisible();
  });
});
