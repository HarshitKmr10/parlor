import { test, expect } from "@playwright/test";

test.describe("notifications inbox", () => {
  test("bell shows unread, opens a notification, and mark-all clears it", async ({ page }) => {
    await page.goto("/dashboard");
    const bell = page.getByRole("button", { name: /notifications/i });
    await expect(bell).toBeVisible();
    // The seeded "recap ready" notification is unread.
    await expect(bell).toHaveAccessibleName(/unread/i);

    await bell.click();
    await expect(page.getByText("Your recap is ready")).toBeVisible();

    // Mark all read clears the unread badge (items remain, now read).
    await page.getByRole("button", { name: /mark all read/i }).click();
    await expect(bell).not.toHaveAccessibleName(/unread/i);
  });
});
