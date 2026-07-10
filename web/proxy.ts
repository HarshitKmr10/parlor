import { NextResponse, type NextRequest } from "next/server";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  API_BASE_URL,
  API_PREFIX,
} from "@/lib/api/config";
import { isTokenExpired } from "@/lib/auth/jwt";

const isProduction = process.env.NODE_ENV === "production";
const REFRESH_MAX_AGE_SEC = 60 * 60 * 24 * 30;
const ACCESS_MAX_AGE_SEC = 60 * 60;

/** Paths under the (app) route group that require an authenticated session. */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/meetings",
  "/ask",
  "/integrations",
  "/settings",
  "/search",
  "/highlights",
  "/action-items",
  "/trackers",
  "/reports",
  "/developers",
];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function redirectToLogin(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(request.nextUrl.pathname)}`;
  return NextResponse.redirect(url);
}

async function tryRefresh(
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string } | null> {
  try {
    const res = await fetch(`${API_BASE_URL}${API_PREFIX}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      accessToken?: string;
      refreshToken?: string;
    };
    if (!data.accessToken || !data.refreshToken) return null;
    return { accessToken: data.accessToken, refreshToken: data.refreshToken };
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!isProtected(pathname)) return NextResponse.next();

  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  // No refresh token at all -> not logged in.
  if (!refreshToken) return redirectToLogin(request);

  // Access token still valid -> proceed.
  if (!isTokenExpired(accessToken)) return NextResponse.next();

  // Access token expired -> attempt a silent refresh.
  const refreshed = await tryRefresh(refreshToken);
  if (!refreshed) {
    const response = redirectToLogin(request);
    response.cookies.set(ACCESS_TOKEN_COOKIE, "", { path: "/", maxAge: 0 });
    response.cookies.set(REFRESH_TOKEN_COOKIE, "", { path: "/", maxAge: 0 });
    return response;
  }

  // Mirror the fresh access token onto the incoming request so the immediate
  // server-component render reads the new token, not the stale one.
  request.cookies.set(ACCESS_TOKEN_COOKIE, refreshed.accessToken);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("cookie", request.cookies.toString());

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  // Persist the rotated tokens back to the browser.
  response.cookies.set(ACCESS_TOKEN_COOKIE, refreshed.accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_MAX_AGE_SEC,
  });
  response.cookies.set(REFRESH_TOKEN_COOKIE, refreshed.refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: REFRESH_MAX_AGE_SEC,
  });
  return response;
}

// Next.js 16 / Turbopack requires `matcher` to be statically analyzable — a
// computed `PROTECTED_PREFIXES.map(...)` is rejected at build time. So this is
// a static literal that MUST be kept in sync with PROTECTED_PREFIXES above
// (each entry is `<prefix>/:path*`).
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/meetings/:path*",
    "/ask/:path*",
    "/integrations/:path*",
    "/settings/:path*",
    "/search/:path*",
    "/highlights/:path*",
    "/action-items/:path*",
    "/trackers/:path*",
    "/reports/:path*",
    "/developers/:path*",
  ],
};
