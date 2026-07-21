import { NextResponse } from "next/server";
import { getShareSettings, putShareSettings } from "@/lib/api/share";
import { ApiError, getErrorMessage } from "@/lib/api/error";
import type { ShareSettings } from "@/lib/api/types";

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
    return NextResponse.json(await getShareSettings());
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
  const b = payload as Partial<ShareSettings>;
  try {
    const saved = await putShareSettings({
      defaultExpiryHours: Number.isFinite(Number(b.defaultExpiryHours))
        ? Math.trunc(Number(b.defaultExpiryHours))
        : 0,
      requirePasscode: Boolean(b.requirePasscode),
      defaultPasscode: typeof b.defaultPasscode === "string" ? b.defaultPasscode : "",
    });
    return NextResponse.json(saved);
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
