import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E config for the Parlor web app.
 *
 * Assumes the full local stack is already running (see native-run-recipe):
 *   - backend  :8000  (DATABASE_URL=postgres parlor, MEETING_JOINER_DB_DRIVER=pg)
 *   - ai-svc   :8100  (AI_MODE=mock)
 *   - web      :3000  (this server; auto-started below, reused if present)
 *
 * The `setup` project signs a fresh user up once and persists the browser
 * session (httpOnly cookies) to `.auth/user.json`; all other specs reuse it.
 */

const WEB_PORT = Number(process.env.PW_WEB_PORT ?? 3000);
const BASE_URL = process.env.PW_BASE_URL ?? `http://localhost:${WEB_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  // Generous but bounded; the mock AI path is fast, the dev server cold-compiles.
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: ".auth/user.json",
      },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: "./node_modules/.bin/next dev -p " + WEB_PORT,
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 60_000,
    env: {
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000",
      API_INTERNAL_URL: process.env.API_INTERNAL_URL ?? "http://localhost:8000",
    },
  },
});
