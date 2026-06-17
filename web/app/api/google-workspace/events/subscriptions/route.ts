import { NextResponse } from "next/server";
import {
  listMeetEventSubscriptions,
  teardownMeetEventSubscriptions,
} from "@/lib/api/google-workspace";
import { ApiError, getErrorMessage } from "@/lib/api/error";

function errorResponse(error: unknown): NextResponse {
  const status = ApiError.isApiError(error) ? error.status : 500;
  const code = ApiError.isApiError(error) ? error.code : "internal_error";
  return NextResponse.json(
    { error: { code, message: getErrorMessage(error) } },
    { status },
  );
}

export async function GET() {
  try {
    const subs = await listMeetEventSubscriptions();
    return NextResponse.json(subs);
  } catch (error: unknown) {
    return errorResponse(error);
  }
}

export async function DELETE() {
  try {
    const summary = await teardownMeetEventSubscriptions();
    return NextResponse.json(summary);
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
