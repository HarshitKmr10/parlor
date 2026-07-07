import "server-only";

import { backendUrl } from "./config";
import { ApiError, isApiErrorBody } from "./error";
import { BACKEND_UNAVAILABLE_CODE, apiFetch } from "./client";
import type {
  ForgotPasswordInput,
  LoginInput,
  LoginResponse,
  MeResponse,
  RefreshResponse,
  ResetPasswordInput,
  SignupInput,
  SignupResponse,
} from "./types";

/**
 * Unauthenticated POST used by the auth route handlers (login/signup/refresh).
 * These run before a session cookie exists, so they hit the backend directly
 * rather than going through the cookie-reading `apiFetch`.
 */
async function authPost<T>(path: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(backendUrl(path), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new ApiError("The backend is not reachable.", {
      code: BACKEND_UNAVAILABLE_CODE,
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
        details: data.error.details,
      });
    }
    throw new ApiError(`Request failed with status ${response.status}.`, {
      code: "http_error",
      status: response.status,
    });
  }

  return data as T;
}

export function signup(input: SignupInput): Promise<SignupResponse> {
  return authPost<SignupResponse>("/auth/signup", input);
}

export function login(input: LoginInput): Promise<LoginResponse> {
  return authPost<LoginResponse>("/auth/login", input);
}

export function refresh(refreshToken: string): Promise<RefreshResponse> {
  return authPost<RefreshResponse>("/auth/refresh", { refreshToken });
}

/** Always resolves — the backend returns 200 whether or not the email exists. */
export function forgotPassword(input: ForgotPasswordInput): Promise<{ message: string }> {
  return authPost<{ message: string }>("/auth/forgot-password", input);
}

export function resetPassword(input: ResetPasswordInput): Promise<{ message: string }> {
  return authPost<{ message: string }>("/auth/reset-password", input);
}

/** Authenticated logout — uses the session access token via apiFetch. */
export function logout(accessToken: string): Promise<void> {
  return apiFetch<void>("/auth/logout", { method: "POST", accessToken });
}

/** Current user + workspaces; reads the session from cookies. */
export function getMe(): Promise<MeResponse> {
  return apiFetch<MeResponse>("/auth/me", { cache: "no-store" });
}
