import { NextResponse } from "next/server";
import { resetPassword } from "@/lib/api/auth";
import { ApiError, getErrorMessage } from "@/lib/api/error";
import type { ResetPasswordInput } from "@/lib/api/types";

function isResetPasswordInput(value: unknown): value is ResetPasswordInput {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.token === "string" && typeof v.newPassword === "string";
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

  if (!isResetPasswordInput(payload)) {
    return NextResponse.json(
      {
        error: {
          code: "validation_error",
          message: "A token and new password are required.",
        },
      },
      { status: 400 },
    );
  }

  if (payload.newPassword.length < 8) {
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
    const result = await resetPassword({
      token: payload.token,
      newPassword: payload.newPassword,
    });
    return NextResponse.json(result);
  } catch (error: unknown) {
    const status = ApiError.isApiError(error) ? error.status : 500;
    const code = ApiError.isApiError(error) ? error.code : "internal_error";
    return NextResponse.json(
      { error: { code, message: getErrorMessage(error) } },
      { status },
    );
  }
}
