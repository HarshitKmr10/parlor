import { NextResponse } from "next/server";
import { createMeeting } from "@/lib/api/meetings";
import { ApiError, getErrorMessage } from "@/lib/api/error";
import type { CreateMeetingInput } from "@/lib/api/types";

function isCreateInput(value: unknown): value is CreateMeetingInput {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.meetingUrl === "string" && v.meetingUrl.length > 0;
}

/** Proxy meeting creation through the cookie-aware server client. */
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

  if (!isCreateInput(payload)) {
    return NextResponse.json(
      {
        error: {
          code: "validation_error",
          message: "A meeting URL is required.",
        },
      },
      { status: 400 },
    );
  }

  try {
    const meeting = await createMeeting({
      meetingUrl: payload.meetingUrl,
      title: payload.title,
      scheduledAt: payload.scheduledAt,
      botName: payload.botName,
    });
    return NextResponse.json(meeting, { status: 201 });
  } catch (error: unknown) {
    const status = ApiError.isApiError(error) ? error.status : 500;
    const code = ApiError.isApiError(error) ? error.code : "internal_error";
    return NextResponse.json(
      { error: { code, message: getErrorMessage(error) } },
      { status },
    );
  }
}
