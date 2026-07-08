import "server-only";

import { apiFetch } from "./client";
import type {
  ApiKey,
  ApiKeyCreated,
  InviteRole,
  WorkspaceInviteCreated,
  WorkspaceInviteListResponse,
} from "./types";

export function listApiKeys(workspaceId: string): Promise<ApiKey[]> {
  return apiFetch<ApiKey[]>(`/workspaces/${workspaceId}/api-keys`, {
    cache: "no-store",
  });
}

export function createApiKey(
  workspaceId: string,
  name: string,
): Promise<ApiKeyCreated> {
  return apiFetch<ApiKeyCreated>(`/workspaces/${workspaceId}/api-keys`, {
    method: "POST",
    body: { name },
  });
}

export function revokeApiKey(
  workspaceId: string,
  keyId: string,
): Promise<void> {
  return apiFetch<void>(`/workspaces/${workspaceId}/api-keys/${keyId}`, {
    method: "DELETE",
  });
}

export function listInvites(
  workspaceId: string,
): Promise<WorkspaceInviteListResponse> {
  return apiFetch<WorkspaceInviteListResponse>(
    `/workspaces/${workspaceId}/invites`,
    { cache: "no-store" },
  );
}

export function createInvite(
  workspaceId: string,
  email: string,
  role: InviteRole,
): Promise<WorkspaceInviteCreated> {
  return apiFetch<WorkspaceInviteCreated>(`/workspaces/${workspaceId}/invites`, {
    method: "POST",
    body: { email, role },
  });
}

export function revokeInvite(
  workspaceId: string,
  inviteId: string,
): Promise<void> {
  return apiFetch<void>(`/workspaces/${workspaceId}/invites/${inviteId}`, {
    method: "DELETE",
  });
}
