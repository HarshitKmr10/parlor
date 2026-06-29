import { test, expect } from "@playwright/test";

test.describe("Ask Verdant (cross-meeting)", () => {
  test("answers across all meetings with meeting-attributed citations", async ({ page }) => {
    await page.goto("/ask");
    await expect(page.getByRole("heading", { name: "Ask Verdant" })).toBeVisible();

    const input = page.getByPlaceholder("Ask across every meeting…");
    await input.fill("Who owns the billing migration?");
    await input.press("Enter");

    // Mock RAG returns a grounded answer + citations.
    await expect(page.getByText(/\[mock\]|billing/i).first()).toBeVisible({ timeout: 15_000 });
    // At least one citation links back to a source meeting.
    const citationLink = page.getByRole("link", { name: /Q3 Roadmap|Acme Corp|Standup/i }).first();
    await expect(citationLink).toBeVisible();
  });
});
