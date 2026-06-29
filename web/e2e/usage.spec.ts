import { test, expect } from "@playwright/test";

test.describe("usage analytics", () => {
  test("owner sees the usage dashboard with seeded meetings", async ({ page }) => {
    await page.goto("/settings/usage");
    await expect(page.getByRole("heading", { name: "Usage" })).toBeVisible();
    await expect(page.getByText("Meetings").first()).toBeVisible();
    await expect(page.getByText("Minutes").first()).toBeVisible();
  });
});
