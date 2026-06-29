import { test, expect } from "@playwright/test";
import { loadSeeded } from "./helpers/seeded";

const seeded = loadSeeded();
const primary = seeded.meetings[0]; // "Q3 Roadmap & Billing Migration"

test.describe("cross-meeting search", () => {
  test("finds a meeting by transcript content", async ({ page }) => {
    await page.goto("/search");
    const box = page.getByRole("searchbox", { name: /search meetings/i });
    await box.fill("billing");
    await box.press("Enter");
    await expect(page).toHaveURL(/\/search\?q=billing/);
    await expect(page.getByRole("heading", { name: primary.title })).toBeVisible();
    // The matched term is marked in a transcript snippet.
    await expect(page.locator("mark", { hasText: /billing/i }).first()).toBeVisible();
  });

  test("nav search link works", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("link", { name: "Search" }).click();
    await expect(page).toHaveURL(/\/search/);
  });
});

test.describe("meeting analytics", () => {
  test("renders talk-time and speakers", async ({ page }) => {
    await page.goto(`/meetings/${primary.id}`);
    await page.getByRole("tab", { name: /analytics/i }).click();
    await expect(page.getByRole("heading", { name: /talk time/i })).toBeVisible();
    await expect(page.getByText("Alice").first()).toBeVisible();
    await expect(page.getByText(/interactivity/i).first()).toBeVisible();
  });
});

test.describe("highlights", () => {
  test("shows seeded highlights on the meeting", async ({ page }) => {
    await page.goto(`/meetings/${primary.id}#highlights`);
    await page.getByRole("tab", { name: /highlights/i }).click();
    await expect(page.getByText("Three Q3 milestones", { exact: true })).toBeVisible();
  });

  test("adds a new highlight", async ({ page }) => {
    await page.goto(`/meetings/${primary.id}#highlights`);
    await page.getByRole("tab", { name: /highlights/i }).click();
    await page.getByPlaceholder("Key decision").fill("E2E marked moment");
    await page.getByPlaceholder("0:30").fill("0:10");
    await page.getByPlaceholder("1:05").fill("0:40");
    await page.getByRole("button", { name: /add highlight/i }).click();
    await expect(page.getByText("E2E marked moment")).toBeVisible();
  });

  test("highlights reel aggregates across meetings", async ({ page }) => {
    await page.goto("/highlights");
    await expect(page.getByRole("heading", { name: "Highlights" })).toBeVisible();
    await expect(page.getByText(/Three Q3 milestones/i).first()).toBeVisible();
  });
});

test.describe("comments", () => {
  test("shows seeded comments and posts a new one", async ({ page }) => {
    await page.goto(`/meetings/${primary.id}#comments`);
    await page.getByRole("tab", { name: /comments/i }).click();
    await expect(page.getByText(/double-check the Friday deadline/i)).toBeVisible();

    await page.getByPlaceholder(/add a comment/i).fill("Adding an E2E comment");
    await page.getByRole("button", { name: /^comment$/i }).click();
    await expect(page.getByText("Adding an E2E comment")).toBeVisible();
  });
});

test.describe("action items tracker", () => {
  test("lists cross-meeting action items and toggles done", async ({ page }) => {
    await page.goto("/action-items");
    await expect(page.getByRole("heading", { name: "Action items" })).toBeVisible();
    const item = page.getByText(/Lead the billing database cutover/i);
    await expect(item).toBeVisible();
    // Switch to "All" so a toggled item stays in view (the Open filter would
    // drop it the moment it's marked done).
    await page.getByRole("button", { name: /^All$/ }).click();
    const checkbox = page.getByRole("checkbox").first();
    const before = await checkbox.getAttribute("aria-checked");
    await checkbox.click();
    await expect(checkbox).toHaveAttribute(
      "aria-checked",
      before === "true" ? "false" : "true",
    );
  });
});

test.describe("reports digest", () => {
  test("renders the workspace digest", async ({ page }) => {
    await page.goto("/reports");
    await expect(page.getByRole("heading", { name: /workspace report/i })).toBeVisible();
    await expect(page.getByText("Meetings").first()).toBeVisible();
    await expect(page.getByText("Hours").first()).toBeVisible();
  });
});

test.describe("sharing", () => {
  test("share button surfaces an existing link", async ({ page }) => {
    await page.goto(`/meetings/${primary.id}`);
    await page.getByRole("button", { name: "Share" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByTestId("share-url")).toHaveValue(/\/share\//);
  });
});
