import "server-only";

import { cookies } from "next/headers";
import {
  ACCESS_TOKEN_COOKIE,
  WORKSPACE_COOKIE,
  backendUrl,
} from "./config";
import { ApiError, isApiErrorBody } from "./error";

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
  body?: unknown;
  /** Override the workspace id; defaults to the workspace cookie. */
  workspaceId?: string;
  /** Bearer token override; defaults to the access-token cookie. */
  accessToken?: string;
  /** Next.js fetch cache controls for server components. */
  cache?: RequestCache;
  revalidate?: number | false;
  signal?: AbortSignal;
};

/** Surfaced when the backend is unreachable so pages can show a friendly state. */
export const BACKEND_UNAVAILABLE_CODE = "backend_unavailable";

/**
 * Server-side fetch against the backend product API. Attaches the Bearer
 * access token and `X-Workspace-Id` from httpOnly cookies, parses the
 * `{ error: { code, message } }` envelope, and throws a typed `ApiError`.
 *
 * Network failures (backend down) throw an `ApiError` with status 503 and the
 * `backend_unavailable` code so the UI can render a "not connected" state
 * rather than crashing.
 */
export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const {
    method = "GET",
    body,
    workspaceId,
    accessToken,
    cache,
    revalidate,
    signal,
  } = options;

  const cookieStore = await cookies();
  const token = accessToken ?? cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  const ws = workspaceId ?? cookieStore.get(WORKSPACE_COOKIE)?.value;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (ws) headers["X-Workspace-Id"] = ws;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const nextConfig: { revalidate?: number | false } = {};
  if (revalidate !== undefined) nextConfig.revalidate = revalidate;

  let response: Response;
  try {
    response = await fetch(backendUrl(path), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache,
      next: revalidate !== undefined ? nextConfig : undefined,
      signal,
    });
  } catch {
    throw new ApiError("The backend is not reachable.", {
      code: BACKEND_UNAVAILABLE_CODE,
      status: 503,
    });
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  const data: unknown = text ? safeJsonParse(text) : null;

  if (!response.ok) {
    if (isApiErrorBody(data)) {
      throw new ApiError(data.error.message, {
        code: data.error.code,
        status: response.status,
        details: data.error.details,
      });
    }
    throw new ApiError(
      `Request failed with status ${response.status}.`,
      { code: "http_error", status: response.status },
    );
  }

  return data as T;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
