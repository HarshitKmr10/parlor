import { NextResponse } from "next/server";
import { getMeetingTags, setMeetingTags } from "@/lib/api/tags";
import { ApiError, getErrorMessage } from "@/lib/api/error";

function errorResponse(error: unknown) {
  const status = ApiError.isApiError(error) ? error.status : 500;
  const code = ApiError.isApiError(error) ? error.code : "internal_error";
  return NextResponse.json(
    { error: { code, message: getErrorMessage(error) } },
    { status },
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ meetingId: string }> },
) {
  const { meetingId } = await params;
  try {
    return NextResponse.json(await getMeetingTags(meetingId));
  } catch (error: unknown) {
    return errorResponse(error);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ meetingId: string }> },
) {
  const { meetingId } = await params;
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "invalid_body", message: "Invalid request body." } },
      { status: 400 },
    );
  }
  const b = payload as Record<string, unknown>;
  const tagIds = Array.isArray(b.tagIds)
    ? (b.tagIds as unknown[]).filter((t): t is string => typeof t === "string")
    : [];
  try {
    return NextResponse.json(await setMeetingTags(meetingId, tagIds));
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
