import { test, expect } from "@playwright/test";
import { loadSeeded } from "./helpers/seeded";

const ERROR_TEXT = /Something went wrong|unexpected error rendering/i;

function routes(): string[] {
  return [
    "/dashboard",
    "/meetings",
    "/search?q=billing",
    "/highlights",
    "/action-items",
    "/trackers",
    "/reports",
    "/ask",
    "/integrations",
    "/settings",
    "/settings/usage",
    "/settings/audit",
    "/settings/compliance",
    "/settings/privacy",
    "/settings/speakers",
    "/settings/digest",
    "/settings/templates",
    "/settings/webhooks",
    "/developers",
  ];
}

test.describe("every authenticated page renders (no error boundary)", () => {
  for (const path of routes()) {
    test(`renders ${path}`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on("pageerror", (e) => consoleErrors.push(e.message));
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await expect(page.getByText(ERROR_TEXT)).toHaveCount(0);
      // Should stay authed (not bounce to /login).
      expect(page.url()).not.toContain("/login");
      expect(consoleErrors, `console errors on ${path}`).toEqual([]);
    });
  }

  test("renders a meeting detail page", async ({ page }) => {
    const { meetings } = loadSeeded();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`/meetings/${meetings[0].id}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText(ERROR_TEXT)).toHaveCount(0);
    expect(page.url()).not.toContain("/login");
    expect(errors).toEqual([]);
  });
});

test.describe("expired access token is transparently refreshed", () => {
  test("pages still render after the access token cookie is dropped", async ({ page, context }) => {
    // Simulate access-token expiry: remove verdant_at, keep verdant_rt.
    const cookies = await context.cookies();
    const kept = cookies.filter((c) => c.name !== "verdant_at");
    await context.clearCookies();
    await context.addCookies(kept);

    await page.goto("/settings/digest", { waitUntil: "domcontentloaded" });
    // Middleware should have refreshed the session -> real page, not login/error.
    await expect(page.getByText(ERROR_TEXT)).toHaveCount(0);
    expect(page.url()).not.toContain("/login");
    await expect(page.getByRole("heading", { name: /digest schedule/i })).toBeVisible();
  });
});
