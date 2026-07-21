import "server-only";

import { apiFetch } from "./client";
import type { ShareSettings } from "./types";

export function getShareSettings(): Promise<ShareSettings> {
  return apiFetch<ShareSettings>("/share-settings", { cache: "no-store" });
}

export function putShareSettings(input: ShareSettings): Promise<ShareSettings> {
  return apiFetch<ShareSettings>("/share-settings", { method: "PUT", body: input });
}
