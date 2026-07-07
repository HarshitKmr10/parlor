import { NextResponse } from "next/server";
import { forgotPassword } from "@/lib/api/auth";
import { ApiError, getErrorMessage } from "@/lib/api/error";
import type { ForgotPasswordInput } from "@/lib/api/types";

function isForgotPasswordInput(value: unknown): value is ForgotPasswordInput {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.email === "string";
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

  if (!isForgotPasswordInput(payload)) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "An email is required." } },
      { status: 400 },
    );
  }

  try {
    const result = await forgotPassword({ email: payload.email });
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
