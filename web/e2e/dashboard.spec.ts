import { test, expect } from "@playwright/test";
import { loadSeeded } from "./helpers/seeded";

test.describe("authenticated app shell + dashboard", () => {
  test("loads the dashboard with seeded meetings", async ({ page }) => {
    await page.goto("/dashboard");
    // App shell navigation is present.
    await expect(page.getByRole("link", { name: "Meetings" })).toBeVisible();
    // At least one seeded meeting title surfaces on the dashboard.
    const { meetings } = loadSeeded();
    await expect(page.getByText(meetings[0].title).first()).toBeVisible();
  });

  test("navigates to the meetings library", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("link", { name: "Meetings" }).click();
    await expect(page).toHaveURL(/\/meetings/);
    const { meetings } = loadSeeded();
    for (const m of meetings) {
      await expect(page.getByText(m.title).first()).toBeVisible();
    }
  });
});
