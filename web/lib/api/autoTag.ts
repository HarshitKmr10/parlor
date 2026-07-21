import "server-only";

import { apiFetch } from "./client";
import type { AutoTagMatchType, AutoTagRule } from "./types";

export function listAutoTagRules(): Promise<AutoTagRule[]> {
  return apiFetch<AutoTagRule[]>("/auto-tag-rules", { cache: "no-store" });
}

export function createAutoTagRule(input: {
  pattern: string;
  matchType: AutoTagMatchType;
  tagId: string;
}): Promise<AutoTagRule> {
  return apiFetch<AutoTagRule>("/auto-tag-rules", { method: "POST", body: input });
}

export function updateAutoTagRule(
  id: string,
  input: {
    pattern?: string;
    matchType?: AutoTagMatchType;
    tagId?: string;
    enabled?: boolean;
  },
): Promise<AutoTagRule> {
  return apiFetch<AutoTagRule>(`/auto-tag-rules/${id}`, { method: "PATCH", body: input });
}

export function deleteAutoTagRule(id: string): Promise<void> {
  return apiFetch<void>(`/auto-tag-rules/${id}`, { method: "DELETE" });
}
