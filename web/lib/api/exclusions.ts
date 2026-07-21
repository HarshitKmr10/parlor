import "server-only";

import { apiFetch } from "./client";
import type { CaptureExclusion, CaptureExclusionMatchType } from "./types";

export function listCaptureExclusions(): Promise<CaptureExclusion[]> {
  return apiFetch<CaptureExclusion[]>("/capture-exclusions", { cache: "no-store" });
}

export function createCaptureExclusion(input: {
  pattern: string;
  matchType: CaptureExclusionMatchType;
  note?: string;
}): Promise<CaptureExclusion> {
  return apiFetch<CaptureExclusion>("/capture-exclusions", {
    method: "POST",
    body: input,
  });
}

export function updateCaptureExclusion(
  id: string,
  input: {
    pattern?: string;
    matchType?: CaptureExclusionMatchType;
    note?: string;
    enabled?: boolean;
  },
): Promise<CaptureExclusion> {
  return apiFetch<CaptureExclusion>(`/capture-exclusions/${id}`, {
    method: "PATCH",
    body: input,
  });
}

export function deleteCaptureExclusion(id: string): Promise<void> {
  return apiFetch<void>(`/capture-exclusions/${id}`, { method: "DELETE" });
}
