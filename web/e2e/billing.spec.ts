import { test, expect } from "@playwright/test";

test.describe("billing & plans", () => {
  test("shows current plan, quota, and upgrades via mock checkout", async ({ page }) => {
    await page.goto("/settings/billing");
    await expect(page.getByRole("heading", { name: "Billing" })).toBeVisible();
    await expect(page.getByText(/current plan/i).first()).toBeVisible();
    // Plan catalog renders.
    await expect(page.getByText("Pro", { exact: true })).toBeVisible();
    await expect(page.getByText("Business", { exact: true })).toBeVisible();

    // Mock-upgrade to Pro (no Stripe key in dev -> immediate upgrade).
    await page.getByRole("button", { name: /upgrade to pro/i }).click();
    await expect(page.getByText(/200 \/ mo|200 meetings/i).first()).toBeVisible({ timeout: 10_000 });
  });
});
