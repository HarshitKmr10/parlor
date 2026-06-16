/**
 * Shared API configuration. The backend base URL comes from the environment
 * with a dev default. This module is server-only — the access token never
 * reaches the client bundle (tokens live in httpOnly cookies).
 */

/**
 * Backend base URL for SERVER-SIDE requests (SSR / route handlers).
 *
 * In Docker, the browser-facing `NEXT_PUBLIC_API_URL` (e.g.
 * `http://localhost:8001`) is not resolvable from inside the web container —
 * server-side fetches must use the internal compose service DNS
 * (`http://backend:8000`). `API_INTERNAL_URL` carries that value and falls
 * back to `NEXT_PUBLIC_API_URL` (then the dev default) so non-Docker setups
 * keep working unchanged.
 */
export const API_BASE_URL =
  process.env.API_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8000";

export const API_PREFIX = "/api/v1";

/** Cookie names for the httpOnly session tokens set by the auth route handlers. */
export const ACCESS_TOKEN_COOKIE = "verdant_at";
export const REFRESH_TOKEN_COOKIE = "verdant_rt";
/** Non-httpOnly cookie carrying the active workspace id (safe to expose). */
export const WORKSPACE_COOKIE = "verdant_ws";

/** Build a fully-qualified backend URL for a `/api/v1` path. */
export function backendUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${API_PREFIX}${normalized}`;
}
