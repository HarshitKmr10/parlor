import { test, expect } from "@playwright/test";

// The marketing site is public; clear any seeded session for these checks.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("landing page", () => {
  test("renders the hero and primary navigation", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toBeVisible();
    await expect(page).toHaveTitle(/Parlor/i);
  });

  test("routes a visitor to sign up", async ({ page }) => {
    await page.goto("/");
    const cta = page.getByRole("link", { name: /get started|sign up|start/i }).first();
    await cta.click();
    await expect(page).toHaveURL(/\/signup/);
    await expect(page.getByRole("heading", { name: /create your workspace/i })).toBeVisible();
  });

  test("login page renders its form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });
});
