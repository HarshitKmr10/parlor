import "server-only";

import { apiFetch } from "./client";
import type { RetentionSettings } from "./types";

export function getRetentionSettings(): Promise<RetentionSettings> {
  return apiFetch<RetentionSettings>("/retention-settings", { cache: "no-store" });
}

export function putRetentionSettings(input: {
  retentionDays: number | null;
  legalHold: boolean;
}): Promise<RetentionSettings> {
  return apiFetch<RetentionSettings>("/retention-settings", {
    method: "PUT",
    body: input,
  });
}

export function exportWorkspace(): Promise<unknown> {
  return apiFetch<unknown>("/export", { cache: "no-store" });
}
