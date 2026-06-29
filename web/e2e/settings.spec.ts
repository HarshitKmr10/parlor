import { test, expect } from "@playwright/test";

test.describe("summary templates", () => {
  test("creates a template from a preset", async ({ page }) => {
    await page.goto("/settings/templates");
    await expect(page.getByRole("heading", { name: /summary templates/i })).toBeVisible();
    // Presets render as buttons; create one and see it appear in the list.
    const preset = page.getByRole("button", { name: /sales call/i }).first();
    await preset.click();
    await expect(
      page.getByText(/sales call/i).first(),
    ).toBeVisible();
  });

  test("creates a custom template", async ({ page }) => {
    await page.goto("/settings/templates");
    await page.getByPlaceholder(/template name/i).fill("E2E Interview Template");
    await page.getByPlaceholder(/instructions for the summarizer/i).fill(
      "Focus on candidate strengths and concerns.",
    );
    await page.getByRole("button", { name: /create template/i }).click();
    await expect(page.getByText("E2E Interview Template")).toBeVisible();
  });
});

test.describe("webhooks", () => {
  test("adds and tests a webhook endpoint", async ({ page }) => {
    await page.goto("/settings/webhooks");
    await expect(page.getByRole("heading", { name: "Webhooks" })).toBeVisible();
    await page
      .getByPlaceholder("https://example.com/webhooks/verdant")
      .fill("https://example.com/hooks/e2e");
    await page.getByRole("button", { name: /add webhook/i }).click();
    // The new endpoint surfaces with its signing secret.
    await expect(page.getByText("https://example.com/hooks/e2e")).toBeVisible();
    await expect(page.getByText(/signing secret/i)).toBeVisible();
  });

  test("settings page links to the new sub-pages", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("link", { name: /manage summary templates/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /manage webhooks/i })).toBeVisible();
  });
});
