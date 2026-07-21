import { test, expect } from "@playwright/test";

test.describe("auto-tag rules", () => {
  test("renders the auto-tag rules page", async ({ page }) => {
    await page.goto("/settings/auto-tags");
    await expect(page.getByRole("heading", { name: /auto-tag rules/i })).toBeVisible();
  });

  test("settings page links to auto-tag rules", async ({ page }) => {
    await page.goto("/settings");
    await expect(
      page.getByRole("link", { name: /manage auto-tag rules/i }),
    ).toBeVisible();
  });
});
