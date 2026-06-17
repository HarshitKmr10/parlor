import { NextResponse } from "next/server";
import { getTranscript } from "@/lib/api/meetings";
import { ApiError, getErrorMessage } from "@/lib/api/error";

/**
 * Same-origin proxy for the meeting transcript. Forwards the httpOnly session
 * cookie/token + `X-Workspace-Id` to the backend (via the shared `apiFetch`
 * client, which reads those cookies server-side) and returns
 * `{ items, lastSegmentAt }`. The live transcript view polls this with a
 * `since` cursor because the browser cannot read the JWT to open the WS itself.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const since = new URL(request.url).searchParams.get("since") ?? undefined;

  try {
    const result = await getTranscript(id, since);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const status = ApiError.isApiError(error) ? error.status : 500;
    const code = ApiError.isApiError(error) ? error.code : "internal_error";
    return NextResponse.json(
      { error: { code, message: getErrorMessage(error) } },
      { status },
    );
  }
}
