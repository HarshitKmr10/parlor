import { NextResponse } from "next/server";
import { acceptInvite } from "@/lib/api/invites";
import { ApiError, getErrorMessage } from "@/lib/api/error";
import { writeSessionCookies } from "@/lib/auth/session";
import type { InviteAcceptInput } from "@/lib/api/types";

function isAcceptBody(value: unknown): value is InviteAcceptInput {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  const nameOk = v.name === undefined || typeof v.name === "string";
  const passwordOk = v.password === undefined || typeof v.password === "string";
  return nameOk && passwordOk;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "invalid_body", message: "Invalid request body." } },
      { status: 400 },
    );
  }

  if (!isAcceptBody(payload)) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Invalid request body." } },
      { status: 400 },
    );
  }

  try {
    const result = await acceptInvite(token, payload);
    const response = NextResponse.json({
      user: result.user,
      workspace: result.workspace,
    });
    writeSessionCookies(response.cookies, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      workspaceId: result.workspace.id,
    });
    return response;
  } catch (error: unknown) {
    const status = ApiError.isApiError(error) ? error.status : 500;
    const code = ApiError.isApiError(error) ? error.code : "internal_error";
    return NextResponse.json(
      { error: { code, message: getErrorMessage(error) } },
      { status },
    );
  }
}
