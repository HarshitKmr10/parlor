import { NextResponse } from "next/server";
import { ssoExchange } from "@/lib/api/sso";
import { writeSessionCookies } from "@/lib/auth/session";

/**
 * OIDC redirect target. Exchanges the code+state for a Parlor session via the
 * backend, sets the httpOnly session cookies, and lands the user on the
 * dashboard — mirroring the password login flow (the web owns the cookies).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(new URL("/login?sso=error", request.url));
  }

  try {
    const result = await ssoExchange(code, state);
    const response = NextResponse.redirect(new URL("/dashboard", request.url));
    writeSessionCookies(response.cookies, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      workspaceId: result.workspace.id,
    });
    return response;
  } catch {
    return NextResponse.redirect(new URL("/login?sso=error", request.url));
  }
}
