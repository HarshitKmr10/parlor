import { test, expect } from "@playwright/test";

test.describe("recap destinations (Notion/HubSpot/Salesforce)", () => {
  test("configures and saves a Notion destination", async ({ page }) => {
    await page.goto("/integrations");
    await expect(page.getByRole("heading", { name: /push recaps to your tools/i })).toBeVisible();
    await expect(page.getByText("Notion", { exact: true })).toBeVisible();
    await expect(page.getByText("HubSpot", { exact: true })).toBeVisible();
    await expect(page.getByText("Salesforce", { exact: true })).toBeVisible();

    await page.getByPlaceholder("secret_…").fill("secret_test_token");
    await page.getByPlaceholder("32-char id").fill("db_test_1234567890");
    // Save the Notion row (first Save button in the destinations grid).
    await page
      .getByRole("button", { name: /^Save$/ })
      .first()
      .click();
    await expect(page.getByText(/^Saved\.$/).first()).toBeVisible();
  });
});
