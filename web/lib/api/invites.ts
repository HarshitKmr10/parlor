import "server-only";

import { apiFetch } from "./client";
import type { InviteAcceptInput, InviteAcceptResponse, InvitePreview } from "./types";

/**
 * Public preview of a pending invite (workspace name, invited email/role).
 * `apiFetch` attaches the session cookie's Bearer token when present, but the
 * backend route doesn't require it — this resolves the same whether or not
 * the visitor is signed in.
 */
export function previewInvite(token: string): Promise<InvitePreview> {
  return apiFetch<InvitePreview>(`/invites/${token}`, { cache: "no-store" });
}

/**
 * Accept an invite. If the visitor has a session cookie for the invited
 * email, `apiFetch` forwards it automatically so the backend can join the
 * existing account to the workspace; otherwise `input` must carry a name +
 * password to create one.
 */
export function acceptInvite(
  token: string,
  input: InviteAcceptInput,
): Promise<InviteAcceptResponse> {
  return apiFetch<InviteAcceptResponse>(`/invites/${token}/accept`, {
    method: "POST",
    body: input,
  });
}
