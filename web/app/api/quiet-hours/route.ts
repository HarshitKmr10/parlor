import { NextResponse } from "next/server";
import { getQuietHours, putQuietHours } from "@/lib/api/quietHours";
import { ApiError, getErrorMessage } from "@/lib/api/error";
import type { QuietHours } from "@/lib/api/types";

function errorResponse(error: unknown) {
  const status = ApiError.isApiError(error) ? error.status : 500;
  const code = ApiError.isApiError(error) ? error.code : "internal_error";
  return NextResponse.json(
    { error: { code, message: getErrorMessage(error) } },
    { status },
  );
}

function clampHour(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(23, Math.max(0, Math.trunc(n)));
}

export async function GET() {
  try {
    return NextResponse.json(await getQuietHours());
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
  const b = payload as Partial<QuietHours>;
  try {
    const saved = await putQuietHours({
      enabled: Boolean(b.enabled),
      startHour: clampHour(b.startHour),
      endHour: clampHour(b.endHour),
    });
    return NextResponse.json(saved);
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
