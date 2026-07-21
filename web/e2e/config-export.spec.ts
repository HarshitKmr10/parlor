import { test, expect } from "@playwright/test";

test.describe("configuration export", () => {
  test("renders the export page heading and download button", async ({ page }) => {
    await page.goto("/settings/export");
    await expect(
      page.getByRole("heading", { name: /export configuration/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /download configuration \(json\)/i }),
    ).toBeVisible();
  });

  test("settings page links to export configuration", async ({ page }) => {
    await page.goto("/settings");
    await expect(
      page.getByRole("link", { name: /export configuration/i }),
    ).toBeVisible();
  });
});
