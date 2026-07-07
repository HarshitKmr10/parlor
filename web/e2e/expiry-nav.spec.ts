import { test, expect } from "@playwright/test";

const ERROR_TEXT = /Something went wrong|unexpected error rendering/i;

// Reproduce the real-user path: an expired access token + client-side nav
// (with prefetch + concurrent RSC) across the pages reported as broken.
test("client-side navigation across pages after token expiry", async ({ page, context }) => {
  // Drop the access token, keep the refresh token (simulate ~1h expiry).
  const cookies = await context.cookies();
  await context.clearCookies();
  await context.addCookies(cookies.filter((c) => c.name !== "parlor_at"));

  await page.goto("/dashboard", { waitUntil: "networkidle" });
  await expect(page.getByText(ERROR_TEXT)).toHaveCount(0);
  expect(page.url()).not.toContain("/login");

  for (const name of ["Trackers", "Reports", "Highlights", "Action items"]) {
    await page.getByRole("link", { name, exact: true }).click();
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(ERROR_TEXT), `error on ${name}`).toHaveCount(0);
    expect(page.url(), `bounced to login on ${name}`).not.toContain("/login");
  }
});
