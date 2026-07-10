import type { ApiErrorBody } from "./types";

/**
 * Typed error thrown by every API client function. Carries the contract
 * `{ error: { code, message } }` envelope plus the HTTP status so callers can
 * branch on `status === 401` (auth) vs domain codes.
 */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(
    message: string,
    options: { code: string; status: number; details?: unknown },
  ) {
    super(message);
    this.name = "ApiError";
    this.code = options.code;
    this.status = options.status;
    this.details = options.details;
  }

  static isApiError(value: unknown): value is ApiError {
    return value instanceof ApiError;
  }
}

/**
 * The backend's stable message for a stale/mismatched `X-Workspace-Id`
 * (revoked membership, switched account, stale cookie) — see
 * `backend/src/api/product/deps.py`. Next.js error boundaries only preserve
 * `Error.message` (and `digest`) across the server/client serialization
 * boundary in production, so this is matched by message rather than by the
 * `ApiError.code`/`status` fields, which do not survive that boundary.
 */
export const WORKSPACE_ACCESS_ERROR_MESSAGE =
  "You are not a member of this workspace";

/** True for a 403 caused by a stale/mismatched workspace, not any other 403. */
export function isWorkspaceAccessError(error: unknown): boolean {
  if (ApiError.isApiError(error)) {
    return error.status === 403 && error.message === WORKSPACE_ACCESS_ERROR_MESSAGE;
  }
  return error instanceof Error && error.message === WORKSPACE_ACCESS_ERROR_MESSAGE;
}

/** Narrow an unknown caught value into a user-facing message. */
export function getErrorMessage(error: unknown): string {
  if (ApiError.isApiError(error)) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

/** Type guard for the contract error envelope. */
export function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { error?: unknown };
  if (typeof candidate.error !== "object" || candidate.error === null) {
    return false;
  }
  const inner = candidate.error as { code?: unknown; message?: unknown };
  return typeof inner.code === "string" && typeof inner.message === "string";
}
