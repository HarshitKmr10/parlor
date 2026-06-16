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
