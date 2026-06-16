import "server-only";

import { apiFetch } from "./client";
import type { ApiKey, ApiKeyCreated } from "./types";

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
