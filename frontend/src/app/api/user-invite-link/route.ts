import { NextRequest, NextResponse } from "next/server";
import {
  INVITE_TOKEN_TTL_MS,
  generateInviteToken,
} from "@/utils/userInvite";

export async function POST(req: NextRequest) {
  try {
    const { email, role, password } = await req.json();

    if (!email || !role || !password) {
      return NextResponse.json(
        { error: "Email, role, and password are required" },
        { status: 400 }
      );
    }

    const expiresAt = new Date(Date.now() + INVITE_TOKEN_TTL_MS).toISOString();
    const token = generateInviteToken({
      email,
      role,
      password,
      expiresAt,
    });

    return NextResponse.json(
      { token, expiresAt },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error("Error generating user invite link:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to generate temporary invite link";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

