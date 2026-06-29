import "server-only";

import { apiFetch } from "./client";
import type { UsageSummary } from "./types";

export function getUsage(): Promise<UsageSummary> {
  return apiFetch<UsageSummary>("/usage", { cache: "no-store" });
}
