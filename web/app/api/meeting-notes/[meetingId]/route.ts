import { NextResponse } from "next/server";
import { getMeetingNote, putMeetingNote } from "@/lib/api/meetingNotes";
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
    return NextResponse.json(await getMeetingNote(meetingId));
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
  const body = typeof b.body === "string" ? b.body : "";
  try {
    return NextResponse.json(await putMeetingNote(meetingId, body));
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
