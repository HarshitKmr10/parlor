import { test, expect } from "@playwright/test";
import { loadSeeded } from "./helpers/seeded";

// Exercise the post-login redirect guard against a real login. Every
// destination in this app (/dashboard, /meetings/*, ...) sits behind the
// proxy middleware AND the (app) layout's server-side getMe() check, so a
// mocked login response (no real Set-Cookie) would bounce every one of these
// post-login navigations back to /login regardless of the fix under test.
// Logging in for real with the workspace the "setup" project seeded avoids
// that false failure.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("login redirect guard", () => {
  test("falls back to /dashboard for a protocol-relative next param", async ({ page }) => {
    const { email, password } = loadSeeded();
    await page.goto("/login?next=%2F%2Fevil.com");
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("falls back to /dashboard for a backslash-prefixed next param", async ({ page }) => {
    const { email, password } = loadSeeded();
    await page.goto("/login?next=%2F%5Cevil.com");
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("honors a genuine same-origin next param", async ({ page }) => {
    const { email, password, meetings } = loadSeeded();
    const meetingId = meetings[0].id;
    await page.goto(`/login?next=%2Fmeetings%2F${meetingId}`);
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(new RegExp(`/meetings/${meetingId}$`));
  });
});
