import { test, expect } from "@playwright/test";

test.describe("multi-language summaries", () => {
  test("sets the summary language and it persists", async ({ page }) => {
    await page.goto("/settings/privacy");
    await expect(page.getByText(/summary language/i)).toBeVisible();

    await page.getByLabel(/summary language/i).selectOption("es");
    await page.getByRole("button", { name: /save privacy settings/i }).click();
    await expect(page.getByText(/^Saved\.$/)).toBeVisible();

    // Reload — the choice persisted.
    await page.reload();
    await expect(page.getByLabel(/summary language/i)).toHaveValue("es");
  });
});
