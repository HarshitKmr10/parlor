import { NextResponse } from "next/server";
import { getMeeting } from "@/lib/api/meetings";
import { ApiError, getErrorMessage } from "@/lib/api/error";

/**
 * Same-origin proxy returning a lightweight meeting-status payload. The live
 * view polls this alongside the transcript so the client knows when the
 * meeting flips to `completed`/`failed` and can stop the REC indicator, freeze
 * the elapsed clock, and surface the "meeting ended" recap CTA. Forwards the
 * httpOnly session cookie + `X-Workspace-Id` via the shared `apiFetch` client.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const meeting = await getMeeting(id);
    return NextResponse.json({
      id: meeting.id,
      status: meeting.status,
      hasSummary: meeting.hasSummary,
      endedAt: meeting.endedAt ?? null,
    });
  } catch (error: unknown) {
    const status = ApiError.isApiError(error) ? error.status : 500;
    const code = ApiError.isApiError(error) ? error.code : "internal_error";
    return NextResponse.json(
      { error: { code, message: getErrorMessage(error) } },
      { status },
    );
  }
}
