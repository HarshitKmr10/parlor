import { test, expect } from "@playwright/test";

test.describe("capture exclusions", () => {
  test("adds a title exclusion rule", async ({ page }) => {
    await page.goto("/settings/exclusions");
    await expect(
      page.getByRole("heading", { name: /capture exclusions/i }),
    ).toBeVisible();

    const pattern = `1:1 ${Date.now()}`;
    await page.getByLabel("Title substring").fill(pattern);
    await page.getByRole("button", { name: /add exclusion/i }).click();

    await expect(page.getByText(pattern)).toBeVisible();
  });

  test("settings page links to capture exclusions", async ({ page }) => {
    await page.goto("/settings");
    await expect(
      page.getByRole("link", { name: /manage capture exclusions/i }),
    ).toBeVisible();
  });
});
