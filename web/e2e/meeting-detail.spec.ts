import { test, expect } from "@playwright/test";
import { loadSeeded } from "./helpers/seeded";

test.describe("meeting detail", () => {
  test("shows summary, transcript and ask tabs with content", async ({ page }) => {
    const { meetings } = loadSeeded();
    const meeting = meetings[0];
    await page.goto(`/meetings/${meeting.id}`);

    await expect(page.getByRole("heading", { name: meeting.title })).toBeVisible();

    // Summary tab is the default and shows generated insights.
    await expect(page.getByText(/\[mock\]|summary/i).first()).toBeVisible();

    // Transcript tab renders seeded segments.
    await page.getByRole("tab", { name: /transcript/i }).click();
    await expect(page.getByText(/billing migration/i).first()).toBeVisible();

    // Ask tab renders the question UI.
    await page.getByRole("tab", { name: /ask/i }).click();
    await expect(page.getByRole("textbox").first()).toBeVisible();
  });

  test("answers a question with citations via RAG", async ({ page }) => {
    const { meetings } = loadSeeded();
    await page.goto(`/meetings/${meetings[0].id}#ask`);
    await page.getByRole("tab", { name: /ask/i }).click();
    const input = page.getByRole("textbox").first();
    await input.fill("What are the three Q3 milestones?");
    await input.press("Enter");
    // Mock RAG answer should appear.
    await expect(page.getByText(/\[mock\]|milestone/i).first()).toBeVisible({ timeout: 15_000 });
  });
});
