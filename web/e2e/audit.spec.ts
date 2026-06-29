import { test, expect } from "@playwright/test";
import { loadSeeded } from "./helpers/seeded";

test.describe("audit log", () => {
  test("records a share action and shows it in the log", async ({ page }) => {
    const { meetings } = loadSeeded();
    // Create a share via the meeting detail Share button.
    await page.goto(`/meetings/${meetings[2].id}`);
    await page.getByRole("button", { name: "Share" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    const create = page.getByRole("button", { name: /create share link/i });
    if (await create.isVisible().catch(() => false)) {
      await create.click();
      await expect(page.getByTestId("share-url")).toBeVisible();
    }

    // The action shows in the audit log.
    await page.goto("/settings/audit");
    await expect(page.getByRole("heading", { name: "Audit log" })).toBeVisible();
    await expect(page.getByText("share.created").first()).toBeVisible();
  });
});
