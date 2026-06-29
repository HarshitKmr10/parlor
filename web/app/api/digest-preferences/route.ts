import { NextResponse } from "next/server";
import { getDigestPreferences, putDigestPreferences } from "@/lib/api/digest";
import { ApiError, getErrorMessage } from "@/lib/api/error";
import type { DigestPreferences } from "@/lib/api/types";

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
    return NextResponse.json(await getDigestPreferences());
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
  const b = payload as Partial<DigestPreferences>;
  try {
    const saved = await putDigestPreferences({
      enabled: Boolean(b.enabled),
      frequency: b.frequency === "daily" ? "daily" : "weekly",
      hourUtc: typeof b.hourUtc === "number" ? b.hourUtc : 13,
      dayOfWeek: typeof b.dayOfWeek === "number" ? b.dayOfWeek : 0,
      channel: b.channel === "slack" ? "slack" : "email",
      target: typeof b.target === "string" ? b.target : undefined,
    });
    return NextResponse.json(saved);
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
