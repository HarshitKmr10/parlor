import { test, expect } from "@playwright/test";

test.describe("personal meeting notes", () => {
  test("shows the private notes editor on a meeting page", async ({ page }) => {
    await page.goto("/meetings");

    const link = page.locator('a[href^="/meetings/"]').first();
    if ((await link.count()) === 0) {
      test.skip(true, "No seeded meeting available to open.");
      return;
    }

    await link.click();
    await page.waitForURL(/\/meetings\/.+/);

    await expect(
      page.getByRole("heading", { name: /your notes/i }),
    ).toBeVisible();
    await expect(page.getByLabel(/your private notes/i)).toBeVisible();
  });
});
