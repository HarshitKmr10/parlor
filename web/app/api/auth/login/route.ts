import { NextResponse } from "next/server";
import { login } from "@/lib/api/auth";
import { ApiError, getErrorMessage } from "@/lib/api/error";
import { writeSessionCookies } from "@/lib/auth/session";
import type { LoginInput } from "@/lib/api/types";

function isLoginInput(value: unknown): value is LoginInput {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.email === "string" && typeof v.password === "string";
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

  if (!isLoginInput(payload)) {
    return NextResponse.json(
      {
        error: {
          code: "validation_error",
          message: "Email and password are required.",
        },
      },
      { status: 400 },
    );
  }

  try {
    const result = await login({
      email: payload.email,
      password: payload.password,
    });
    const response = NextResponse.json({ user: result.user });
    writeSessionCookies(response.cookies, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
    return response;
  } catch (error: unknown) {
    const status = ApiError.isApiError(error) ? error.status : 500;
    const code = ApiError.isApiError(error) ? error.code : "internal_error";
    return NextResponse.json(
      { error: { code, message: getErrorMessage(error) } },
      { status: status === 401 ? 401 : status },
    );
  }
}
