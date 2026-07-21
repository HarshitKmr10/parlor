import "server-only";

import { apiFetch } from "./client";
import type { QuietHours } from "./types";

export function getQuietHours(): Promise<QuietHours> {
  return apiFetch<QuietHours>("/quiet-hours", { cache: "no-store" });
}

export function putQuietHours(input: QuietHours): Promise<QuietHours> {
  return apiFetch<QuietHours>("/quiet-hours", { method: "PUT", body: input });
}
