import { NextResponse } from "next/server";
import { ssoAuthorizeUrl } from "@/lib/api/sso";

/** Kick off the OIDC flow: fetch the IdP authorize URL and redirect there. */
export async function GET(request: Request) {
  try {
    const { url } = await ssoAuthorizeUrl();
    return NextResponse.redirect(url);
  } catch {
    return NextResponse.redirect(new URL("/login?sso=unavailable", request.url));
  }
}
