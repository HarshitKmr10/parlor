import { test, expect } from "@playwright/test";

test.describe("meeting tags", () => {
  test("creates a tag and sees it in the list", async ({ page }) => {
    await page.goto("/settings/tags");
    await expect(
      page.getByRole("heading", { name: /meeting tags/i }),
    ).toBeVisible();

    const tagName = `Sales ${Date.now()}`;
    await page.getByLabel("Tag name").fill(tagName);
    await page.getByRole("button", { name: /add tag/i }).click();

    await expect(page.getByText(tagName)).toBeVisible();
  });

  test("settings page links to meeting tags", async ({ page }) => {
    await page.goto("/settings");
    await expect(
      page.getByRole("link", { name: /manage meeting tags/i }),
    ).toBeVisible();
  });
});
