import { test, expect } from "@playwright/test";

test.describe("sharing defaults", () => {
  test("configures and saves sharing defaults", async ({ page }) => {
    await page.goto("/settings/sharing");
    await expect(page.getByRole("heading", { name: /sharing defaults/i })).toBeVisible();

    // Toggle require-passcode on, then save.
    await page.getByRole("switch", { name: /require passcode/i }).click();
    await page.getByRole("button", { name: /save sharing defaults/i }).click();
    await expect(page.getByText(/^Saved\.$/)).toBeVisible();
  });

  test("settings page links to sharing defaults", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("link", { name: /manage sharing defaults/i })).toBeVisible();
  });
});
