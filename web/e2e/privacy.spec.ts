import { test, expect } from "@playwright/test";

test.describe("privacy & redaction", () => {
  test("enables redaction and saves custom vocabulary", async ({ page }) => {
    await page.goto("/settings/privacy");
    await expect(page.getByRole("heading", { name: /redaction & vocabulary/i })).toBeVisible();

    await page.getByRole("switch", { name: /enable redaction/i }).click();
    // Sub-toggles appear when redaction is on.
    await expect(page.getByText(/email addresses/i)).toBeVisible();

    await page.getByPlaceholder(/Verdant, pgvector/i).fill("Verdant, pgvector, ARR");
    await page.getByRole("button", { name: /save privacy settings/i }).click();
    await expect(page.getByText(/^Saved\.$/)).toBeVisible();
  });
});
