import { test, expect } from "@playwright/test";

test.describe("scheduled digest", () => {
  test("configures and sends a test digest", async ({ page }) => {
    await page.goto("/settings/digest");
    await expect(page.getByRole("heading", { name: /digest schedule/i })).toBeVisible();

    // Enable + set an email target.
    await page.getByRole("switch", { name: /enable digests/i }).click();
    await page.getByPlaceholder("team@example.com").fill("ops@example.com");
    await page.getByRole("button", { name: /save preferences/i }).click();
    await expect(page.getByText(/^Saved\.$/)).toBeVisible();

    // Send a test now — mock SMTP logs, so it reports delivered.
    await page.getByRole("button", { name: /send a test now/i }).click();
    await expect(page.getByText(/Sent \(/)).toBeVisible();
  });

  test("settings page links to the digest schedule", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("link", { name: /configure digest schedule/i })).toBeVisible();
  });
});
