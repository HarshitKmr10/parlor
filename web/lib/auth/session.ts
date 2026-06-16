import "server-only";

import { cookies } from "next/headers";
import type { ResponseCookies } from "next/dist/server/web/spec-extension/cookies";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  WORKSPACE_COOKIE,
} from "@/lib/api/config";

/** Refresh tokens are long-lived; access tokens are short and re-derived. */
const REFRESH_MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days
const ACCESS_MAX_AGE_SEC = 60 * 60; // 1 hour (upper bound; JWT exp wins)

const isProduction = process.env.NODE_ENV === "production";

type SessionInput = {
  accessToken: string;
  refreshToken: string;
  workspaceId?: string;
};

const baseCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax" as const,
  path: "/",
};

/**
 * Cookie setter compatible with both Next route-handler `cookies()` (mutable)
 * and a `NextResponse.cookies` jar (used by middleware). Tokens are httpOnly +
 * secure; the workspace id is readable (non-sensitive) for the client store.
 */
type CookieJar = Pick<ResponseCookies, "set">;

export function writeSessionCookies(jar: CookieJar, input: SessionInput): void {
  jar.set(ACCESS_TOKEN_COOKIE, input.accessToken, {
    ...baseCookieOptions,
    maxAge: ACCESS_MAX_AGE_SEC,
  });
  jar.set(REFRESH_TOKEN_COOKIE, input.refreshToken, {
    ...baseCookieOptions,
    maxAge: REFRESH_MAX_AGE_SEC,
  });
  if (input.workspaceId) {
    jar.set(WORKSPACE_COOKIE, input.workspaceId, {
      httpOnly: false,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: REFRESH_MAX_AGE_SEC,
    });
  }
}

export function clearSessionCookies(jar: CookieJar): void {
  const expired = { ...baseCookieOptions, maxAge: 0 };
  jar.set(ACCESS_TOKEN_COOKIE, "", expired);
  jar.set(REFRESH_TOKEN_COOKIE, "", expired);
  jar.set(WORKSPACE_COOKIE, "", {
    httpOnly: false,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/** Read the current session tokens from the request cookies (server-side). */
export async function readSession(): Promise<{
  accessToken?: string;
  refreshToken?: string;
  workspaceId?: string;
}> {
  const store = await cookies();
  return {
    accessToken: store.get(ACCESS_TOKEN_COOKIE)?.value,
    refreshToken: store.get(REFRESH_TOKEN_COOKIE)?.value,
    workspaceId: store.get(WORKSPACE_COOKIE)?.value,
  };
}

/** Set the active workspace cookie (used by the workspace switcher action). */
export async function setActiveWorkspace(workspaceId: string): Promise<void> {
  const store = await cookies();
  store.set(WORKSPACE_COOKIE, workspaceId, {
    httpOnly: false,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: REFRESH_MAX_AGE_SEC,
  });
}
