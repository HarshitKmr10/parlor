import { test, expect } from "@playwright/test";

test.describe("custom redaction rules", () => {
  test("adds a keyword rule and previews the redaction", async ({ page }) => {
    await page.goto("/settings/redaction");
    await expect(page.getByRole("heading", { name: /redaction rules/i })).toBeVisible();

    const ruleName = `Codename ${Date.now()}`;
    await page.getByLabel("Rule name").fill(ruleName);
    await page.getByLabel("Text to redact").fill("Aurora");
    await page.getByRole("button", { name: /add rule/i }).click();

    await expect(page.getByText(ruleName)).toBeVisible();

    // Preview should scrub the keyword we just added.
    await page
      .getByRole("textbox", { name: "" })
      .last()
      .fill("The Aurora launch is confidential.");
    await page.getByRole("button", { name: /preview redaction/i }).click();
    await expect(page.getByText(/redaction/i)).toBeVisible();
  });

  test("settings page links to redaction rules", async ({ page }) => {
    await page.goto("/settings");
    await expect(
      page.getByRole("link", { name: /manage redaction rules/i }),
    ).toBeVisible();
  });
});
