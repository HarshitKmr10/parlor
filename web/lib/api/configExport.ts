import "server-only";

import { apiFetch } from "./client";

/** The Parlor configuration bundle is a dynamic-shaped JSON object. */
export type ConfigExport = Record<string, unknown>;

export function getConfigExport(): Promise<ConfigExport> {
  return apiFetch<ConfigExport>("/config-export", { cache: "no-store" });
}
