import { NextResponse } from "next/server";
import { getCapturePrefs, putCapturePrefs } from "@/lib/api/capturePrefs";
import { ApiError, getErrorMessage } from "@/lib/api/error";
import type { CapturePrefs } from "@/lib/api/types";

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
    return NextResponse.json(await getCapturePrefs());
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
  const b = payload as Partial<CapturePrefs>;
  try {
    const saved = await putCapturePrefs({
      autoJoinEnabled: Boolean(b.autoJoinEnabled),
      joinLeadMinutes: Number.isFinite(Number(b.joinLeadMinutes))
        ? Math.trunc(Number(b.joinLeadMinutes))
        : 2,
      joinZoom: Boolean(b.joinZoom),
      joinMeet: Boolean(b.joinMeet),
      joinTeams: Boolean(b.joinTeams),
    });
    return NextResponse.json(saved);
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
