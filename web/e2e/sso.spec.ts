import { test, expect } from "@playwright/test";

// SSO is config-gated; clear the seeded session for these public-page checks.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("SSO sign-in", () => {
  test("hides the SSO button when SSO is disabled", async ({ page }) => {
    await page.route("**/api/auth/sso/status", (route) =>
      route.fulfill({ json: { enabled: false, provider: null } }),
    );
    await page.goto("/login");
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /sign in with/i })).toHaveCount(0);
  });

  test("shows a provider SSO button when enabled", async ({ page }) => {
    await page.route("**/api/auth/sso/status", (route) =>
      route.fulfill({ json: { enabled: true, provider: "okta" } }),
    );
    await page.goto("/login");
    const sso = page.getByRole("link", { name: /sign in with okta/i });
    await expect(sso).toBeVisible();
    await expect(sso).toHaveAttribute("href", "/api/auth/sso/start");
  });
});
