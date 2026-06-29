import "server-only";

import { apiFetch } from "./client";
import type { SignupResponse } from "./types";

export interface SsoStatus {
  enabled: boolean;
  provider: string | null;
}

export function ssoStatus(): Promise<SsoStatus> {
  return apiFetch<SsoStatus>("/auth/sso/status", { cache: "no-store" });
}

export function ssoAuthorizeUrl(): Promise<{ url: string }> {
  return apiFetch<{ url: string }>("/auth/sso/authorize-url", { cache: "no-store" });
}

export function ssoExchange(code: string, state: string): Promise<SignupResponse> {
  return apiFetch<SignupResponse>("/auth/sso/exchange", {
    method: "POST",
    body: { code, state },
  });
}
