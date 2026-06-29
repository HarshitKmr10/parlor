import { test, expect } from "@playwright/test";
import { loadSeeded } from "./helpers/seeded";

test.describe("coaching scorecard", () => {
  test("shows a grade, tips, and per-speaker breakdown", async ({ page }) => {
    const { meetings } = loadSeeded();
    await page.goto(`/meetings/${meetings[0].id}#coaching`);
    await page.getByRole("tab", { name: /coaching/i }).click();
    await expect(page.getByText(/coaching score/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: /coaching tips/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /by speaker/i })).toBeVisible();
  });
});
