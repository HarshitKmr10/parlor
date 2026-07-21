import { test, expect } from "@playwright/test";

test.describe("prompt library", () => {
  test("saves a prompt and shows it in the list", async ({ page }) => {
    await page.goto("/settings/prompts");
    await expect(page.getByRole("heading", { name: /prompt library/i })).toBeVisible();

    const title = `Standup recap ${Date.now()}`;
    await page.getByLabel("Prompt title").fill(title);
    await page.getByLabel("Prompt").fill("Summarize the key decisions and open questions.");
    await page.getByRole("button", { name: /save prompt/i }).click();

    await expect(page.getByText(title)).toBeVisible();
  });

  test("settings page links to the prompt library", async ({ page }) => {
    await page.goto("/settings");
    await expect(
      page.getByRole("link", { name: /manage prompt library/i }),
    ).toBeVisible();
  });
});
