import { NextResponse } from "next/server";
import { ssoStatus } from "@/lib/api/sso";

export async function GET() {
  try {
    return NextResponse.json(await ssoStatus());
  } catch {
    // If the backend is unreachable, treat SSO as unavailable.
    return NextResponse.json({ enabled: false, provider: null });
  }
}
