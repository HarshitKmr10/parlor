import "server-only";

import { apiFetch } from "./client";

/**
 * Typed client for org-wide Google Workspace / Google Meet capture.
 *
 * Mirrors the backend Pydantic models (camelCase JSON) in
 * `backend/src/api/product/schemas.py`. The service-account JSON is a SECRET:
 * it is sent once on configure and NEVER returned — the server only ever
 * surfaces a fingerprint. Do not log, store, or echo it back to the client.
 *
 * Server-side reads use `apiFetch` (attaches the Bearer + workspace cookies).
 * Browser writes go through the same-origin route handlers under
 * `/api/google-workspace/*` via the `lib/api/browser.ts` helpers.
 */

export type WorkspaceAuthMode = "dwd" | "marketplace";
export type PolicyMode = "all" | "allowlist" | "denylist";

/** Public view of the org config — never includes the raw SA JSON. */
export interface GoogleWorkspaceConfig {
  workspaceId: string;
  authMode: WorkspaceAuthMode;
  domain: string | null;
  customerId: string | null;
  delegatedAdminEmail: string | null;
  marketplaceClientId: string | null;
  marketplaceProjectNumber: string | null;
  notetakerEmail: string | null;
  hasServiceAccount: boolean;
  serviceAccountFingerprint: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Configure request. `serviceAccountJson` is sensitive and never echoed back. */
export interface GoogleWorkspaceConfigRequest {
  authMode: WorkspaceAuthMode;
  serviceAccountJson?: string;
  delegatedAdminEmail?: string;
  domain?: string;
  customerId?: string;
  notetakerEmail?: string;
  enabled: boolean;
}

export interface GoogleWorkspaceUsersResponse {
  users: string[];
  total: number;
}

export interface EventSubscription {
  id: string;
  workspaceId: string;
  googleSubscriptionId: string | null;
  targetUserEmail: string;
  eventTypes: string[];
  expireTime: string | null;
  state: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface EventSubscriptionsResponse {
  subscriptions: EventSubscription[];
  total: number;
}

export interface EventSubscribeResponse {
  created: number;
  failed: number;
  total: number;
}

export interface PolicyRules {
  emails: string[];
  domains: string[];
  ous: string[];
}

export interface OrgMeetingPolicy {
  autoJoinEnabled: boolean;
  mode: PolicyMode;
  allow: PolicyRules;
  deny: PolicyRules;
  optOutEmails: string[];
  recordingDisclosureText: string | null;
}

/* ---- Server-side reads (route handlers + RSC) ---- */

/** Current org config. Throws `ApiError` 400 `google_workspace_not_configured`
 * when no org is configured for the workspace. */
export function getGoogleWorkspaceConfig(): Promise<GoogleWorkspaceConfig> {
  return apiFetch<GoogleWorkspaceConfig>("/google-workspace", {
    cache: "no-store",
  });
}

export function configureGoogleWorkspace(
  body: GoogleWorkspaceConfigRequest,
): Promise<GoogleWorkspaceConfig> {
  return apiFetch<GoogleWorkspaceConfig>("/google-workspace", {
    method: "POST",
    body,
  });
}

export function deleteGoogleWorkspace(): Promise<{ deleted: boolean }> {
  return apiFetch<{ deleted: boolean }>("/google-workspace", {
    method: "DELETE",
  });
}

/** Discovered org users — proves Directory + DWD work. Throws 400 when the
 * org is not configured. */
export function listGoogleWorkspaceUsers(): Promise<GoogleWorkspaceUsersResponse> {
  return apiFetch<GoogleWorkspaceUsersResponse>("/google-workspace/users", {
    cache: "no-store",
  });
}

export function subscribeMeetEvents(): Promise<EventSubscribeResponse> {
  return apiFetch<EventSubscribeResponse>(
    "/google-workspace/events/subscribe",
    { method: "POST" },
  );
}

export function listMeetEventSubscriptions(): Promise<EventSubscriptionsResponse> {
  return apiFetch<EventSubscriptionsResponse>(
    "/google-workspace/events/subscriptions",
    { cache: "no-store" },
  );
}

export function teardownMeetEventSubscriptions(): Promise<unknown> {
  return apiFetch<unknown>("/google-workspace/events/subscriptions", {
    method: "DELETE",
  });
}

export function getOrgMeetingPolicy(): Promise<OrgMeetingPolicy> {
  return apiFetch<OrgMeetingPolicy>("/google-workspace/policy", {
    cache: "no-store",
  });
}

export function putOrgMeetingPolicy(
  body: OrgMeetingPolicy,
): Promise<OrgMeetingPolicy> {
  return apiFetch<OrgMeetingPolicy>("/google-workspace/policy", {
    method: "PUT",
    body,
  });
}
