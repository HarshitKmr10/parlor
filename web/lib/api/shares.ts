import "server-only";

import { apiFetch } from "./client";
import { backendUrl } from "./config";
import type { CreateShareInput, PublicMeetingView, ShareLink } from "./types";
import { ApiError, isApiErrorBody } from "./error";

export function getShare(meetingId: string): Promise<ShareLink> {
  return apiFetch<ShareLink>(`/meetings/${meetingId}/share`, {
    cache: "no-store",
  });
}

export function createShare(
  meetingId: string,
  input: CreateShareInput = {},
): Promise<ShareLink> {
  return apiFetch<ShareLink>(`/meetings/${meetingId}/share`, {
    method: "POST",
    body: input,
  });
}

export function revokeShare(meetingId: string): Promise<void> {
  return apiFetch<void>(`/meetings/${meetingId}/share`, { method: "DELETE" });
}

/**
 * Fetch a public recap by capability token. This is intentionally
 * UNAUTHENTICATED — no cookies are attached — and is safe to call from the
 * public `/share/[token]` route for anonymous visitors.
 */
export async function getPublicShare(token: string): Promise<PublicMeetingView> {
  let response: Response;
  try {
    response = await fetch(backendUrl(`/public/shares/${token}`), {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
  } catch {
    throw new ApiError("The backend is not reachable.", {
      code: "backend_unavailable",
      status: 503,
    });
  }
  const text = await response.text();
  const data: unknown = text ? JSON.parse(text) : null;
  if (!response.ok) {
    if (isApiErrorBody(data)) {
      throw new ApiError(data.error.message, {
        code: data.error.code,
        status: response.status,
      });
    }
    throw new ApiError("This share link is invalid or has expired.", {
      code: "not_found",
      status: response.status,
    });
  }
  return data as PublicMeetingView;
}
