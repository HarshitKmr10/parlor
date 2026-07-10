import { test, expect } from "@playwright/test";

test.describe("developer docs + global search", () => {
  test("developers page shows guides and quickstart", async ({ page }) => {
    await page.goto("/developers");
    await expect(page.getByRole("heading", { name: "Developers" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Guides" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Quickstart" })).toBeVisible();
  });

  test("global top-bar search routes to results", async ({ page }) => {
    await page.goto("/dashboard");
    const box = page.getByRole("searchbox", { name: /global search/i });
    await expect(box).toBeVisible();
    await box.fill("billing");
    await box.press("Enter");
    await expect(page).toHaveURL(/\/search\?q=billing/);
  });
});
