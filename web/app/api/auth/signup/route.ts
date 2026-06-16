import { NextResponse } from "next/server";
import { signup } from "@/lib/api/auth";
import { ApiError, getErrorMessage } from "@/lib/api/error";
import { writeSessionCookies } from "@/lib/auth/session";
import type { SignupInput } from "@/lib/api/types";

function isSignupInput(value: unknown): value is SignupInput {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.email === "string" &&
    typeof v.password === "string" &&
    typeof v.name === "string" &&
    typeof v.workspaceName === "string"
  );
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "invalid_body", message: "Invalid request body." } },
      { status: 400 },
    );
  }

  if (!isSignupInput(payload)) {
    return NextResponse.json(
      {
        error: {
          code: "validation_error",
          message: "Name, email, password, and workspace name are required.",
        },
      },
      { status: 400 },
    );
  }

  if (payload.password.length < 8) {
    return NextResponse.json(
      {
        error: {
          code: "validation_error",
          message: "Password must be at least 8 characters.",
        },
      },
      { status: 400 },
    );
  }

  try {
    const result = await signup({
      email: payload.email,
      password: payload.password,
      name: payload.name,
      workspaceName: payload.workspaceName,
    });
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
