import "server-only";

import { apiFetch } from "./client";
import type { BillingStatus } from "./types";

export function getBilling(): Promise<BillingStatus> {
  return apiFetch<BillingStatus>("/billing", { cache: "no-store" });
}

export function checkout(plan: "pro" | "business"): Promise<BillingStatus> {
  return apiFetch<BillingStatus>("/billing/checkout", {
    method: "POST",
    body: { plan },
  });
}
