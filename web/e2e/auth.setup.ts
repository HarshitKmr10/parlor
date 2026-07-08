/**
 * One-time setup project: create a fresh workspace, seed realistic meetings via
 * the backend, then log that user into the browser and persist the session so
 * every other spec starts authenticated with data already present.
 */
import { test as setup, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { signup } from "./helpers/backend";
import { seedWorkspace } from "./helpers/seed";

const STORAGE = ".auth/user.json";
const ARTIFACT = "e2e/.artifacts/seeded.json";

setup("authenticate and seed workspace", async ({ page }) => {
  setup.setTimeout(180_000);

  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const email = `e2e+${stamp}@example.com`;
  const password = "parlor-e2e-pass-123";

  // 1. Create the account + workspace straight against the backend so we hold
  //    the bearer token needed for seeding.
  const acct = await signup({
    email,
    password,
    name: "E2E Tester",
    workspaceName: "E2E Workspace",
  });

  // 2. Seed three meetings end-to-end (transcript → summary → embeddings →
  //    highlights/comments/action-items/share).
  const meetings = await seedWorkspace(acct);
  expect(meetings.length).toBeGreaterThanOrEqual(3);

  // 3. Log the same user into the browser via the Next route handler so the
  //    httpOnly session cookies land in the context cookie jar.
  const res = await page.request.post("/api/auth/login", {
    data: { email, password },
  });
  expect(res.ok()).toBeTruthy();

  // 4. Persist browser session + seeded ids for the specs.
  mkdirSync(dirname(STORAGE), { recursive: true });
  await page.context().storageState({ path: STORAGE });

  mkdirSync(dirname(ARTIFACT), { recursive: true });
  writeFileSync(
    ARTIFACT,
    JSON.stringify(
      { email, password, workspaceId: acct.workspaceId, userId: acct.userId, meetings },
      null,
      2,
    ),
  );
});
