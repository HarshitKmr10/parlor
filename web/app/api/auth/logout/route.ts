import { NextResponse } from "next/server";
import { logout } from "@/lib/api/auth";
import { clearSessionCookies, readSession } from "@/lib/auth/session";

export async function POST() {
  const { accessToken } = await readSession();

  // Best-effort backend logout; clear local cookies regardless of the result.
  if (accessToken) {
    try {
      await logout(accessToken);
    } catch {
      // Ignore — the session is being torn down locally anyway.
    }
  }

  const response = NextResponse.json({ ok: true });
  clearSessionCookies(response.cookies);
  return response;
}
