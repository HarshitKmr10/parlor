import { NextResponse } from "next/server";
import { updateCalendarAccount } from "@/lib/api/calendar";
import { ApiError, getErrorMessage } from "@/lib/api/error";

function isPatchBody(value: unknown): value is { autoJoin: boolean } {
  if (typeof value !== "object" || value === null) return false;
  return typeof (value as Record<string, unknown>).autoJoin === "boolean";
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "invalid_body", message: "Invalid request body." } },
      { status: 400 },
    );
  }

  if (!isPatchBody(payload)) {
    return NextResponse.json(
      {
        error: { code: "validation_error", message: "autoJoin is required." },
      },
      { status: 400 },
    );
  }

  try {
    const account = await updateCalendarAccount(id, payload.autoJoin);
    return NextResponse.json(account);
  } catch (error: unknown) {
    const status = ApiError.isApiError(error) ? error.status : 500;
    const code = ApiError.isApiError(error) ? error.code : "internal_error";
    return NextResponse.json(
      { error: { code, message: getErrorMessage(error) } },
      { status },
    );
  }
}
