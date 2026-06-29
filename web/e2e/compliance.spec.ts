import { test, expect } from "@playwright/test";

test.describe("retention & compliance", () => {
  test("sets a retention policy and exposes data export", async ({ page }) => {
    await page.goto("/settings/compliance");
    await expect(page.getByRole("heading", { name: /retention & data/i })).toBeVisible();

    // Turn off "keep forever" to reveal the retention window, set it, save.
    await page.getByRole("switch", { name: /keep forever/i }).click();
    await page.getByLabel(/delete meetings older than/i).fill("120");
    await page.getByRole("button", { name: /save retention policy/i }).click();
    await expect(page.getByText(/^Saved\.$/)).toBeVisible();

    // Export link is present and points at the export route.
    const exportLink = page.getByRole("link", { name: /export workspace data/i });
    await expect(exportLink).toHaveAttribute("href", "/api/export");
  });

  test("export route returns a JSON attachment", async ({ page }) => {
    const res = await page.request.get("/api/export");
    expect(res.ok()).toBeTruthy();
    expect(res.headers()["content-disposition"]).toContain("verdant-export.json");
    const body = await res.json();
    expect(body).toHaveProperty("meetings");
  });
});
