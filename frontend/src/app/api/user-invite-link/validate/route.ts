import { NextRequest, NextResponse } from "next/server";
import { decodeInviteToken } from "@/utils/userInvite";

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json(
        { error: "Missing invite token" },
        { status: 400 }
      );
    }

    const payload = decodeInviteToken(token);

    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    console.error("Error validating invite token:", error);
    const message =
      error instanceof Error ? error.message : "Invalid or expired invite link";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}

