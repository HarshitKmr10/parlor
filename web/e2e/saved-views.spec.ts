import { test, expect } from "@playwright/test";

test.describe("saved views", () => {
  test("saves a view and shows it in the list", async ({ page }) => {
    await page.goto("/settings/views");
    await expect(page.getByRole("heading", { name: /saved views/i })).toBeVisible();

    const name = `Open items ${Date.now()}`;
    await page.getByLabel("View name").fill(name);
    await page.getByLabel("Search query").fill("status:open owner:me");
    await page.getByRole("button", { name: /save view/i }).click();

    await expect(page.getByText(name)).toBeVisible();
  });

  test("settings page links to saved views", async ({ page }) => {
    await page.goto("/settings");
    await expect(
      page.getByRole("link", { name: /manage saved views/i }),
    ).toBeVisible();
  });
});
