import { NextResponse } from "next/server";
import { getRetentionSettings, putRetentionSettings } from "@/lib/api/compliance";
import { ApiError, getErrorMessage } from "@/lib/api/error";
import type { RetentionSettings } from "@/lib/api/types";

function errorResponse(error: unknown) {
  const status = ApiError.isApiError(error) ? error.status : 500;
  const code = ApiError.isApiError(error) ? error.code : "internal_error";
  return NextResponse.json(
    { error: { code, message: getErrorMessage(error) } },
    { status },
  );
}

export async function GET() {
  try {
    return NextResponse.json(await getRetentionSettings());
  } catch (error: unknown) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "invalid_body", message: "Invalid request body." } },
      { status: 400 },
    );
  }
  const b = payload as Partial<RetentionSettings>;
  try {
    const saved = await putRetentionSettings({
      retentionDays:
        typeof b.retentionDays === "number" && b.retentionDays > 0
          ? b.retentionDays
          : null,
      legalHold: Boolean(b.legalHold),
    });
    return NextResponse.json(saved);
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
