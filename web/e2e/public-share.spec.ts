import { test, expect } from "@playwright/test";
import { loadSeeded } from "./helpers/seeded";

// The public recap is unauthenticated — clear the seeded session.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("public share recap", () => {
  test("renders a seeded share token for an anonymous visitor", async ({ page }) => {
    const seeded = loadSeeded();
    const withShare = seeded.meetings.find((m) => m.shareToken);
    expect(withShare?.shareToken).toBeTruthy();

    await page.goto(`/share/${withShare!.shareToken}`);
    await expect(page.getByRole("heading", { name: withShare!.title })).toBeVisible();
    await expect(page.getByRole("link", { name: /try verdant/i })).toBeVisible();
  });

  test("shows a friendly error for an invalid token", async ({ page }) => {
    await page.goto("/share/not-a-real-token-000");
    await expect(page.getByText(/isn’t available|isn't available/i)).toBeVisible();
  });
});
