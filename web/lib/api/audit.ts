import "server-only";

import { apiFetch } from "./client";
import type { AuditEventListResponse } from "./types";

export function listAuditEvents(): Promise<AuditEventListResponse> {
  return apiFetch<AuditEventListResponse>("/audit-events", { cache: "no-store" });
}
