import { test, expect } from "@playwright/test";

test.describe("speaker identities", () => {
  test("creates a speaker profile with aliases", async ({ page }) => {
    await page.goto("/settings/speakers");
    await expect(page.getByRole("heading", { name: /speaker identities/i })).toBeVisible();

    const name = `Alice Chen ${Date.now()}`;
    await page.getByPlaceholder(/display name/i).fill(name);
    await page.getByPlaceholder(/aliases/i).fill("Speaker 1, Alice");
    await page.getByRole("button", { name: /add person/i }).click();

    await expect(page.getByText(name)).toBeVisible();
    await expect(page.getByText("Speaker 1").first()).toBeVisible();
  });
});
