import "server-only";

import { apiFetch } from "./client";
import type { Integration, IntegrationKind } from "./types";

export function listIntegrations(): Promise<Integration[]> {
  return apiFetch<Integration[]>("/integrations", { cache: "no-store" });
}

export function upsertIntegration(input: {
  kind: IntegrationKind;
  enabled: boolean;
  config: Record<string, string>;
}): Promise<Integration> {
  return apiFetch<Integration>("/integrations", { method: "PUT", body: input });
}
