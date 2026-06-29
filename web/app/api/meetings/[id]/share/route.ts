import { NextResponse } from "next/server";
import { createShare, getShare, revokeShare } from "@/lib/api/shares";
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
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    return NextResponse.json(await getShare(id));
  } catch (error: unknown) {
    return errorResponse(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let payload: Record<string, unknown> = {};
  try {
    const raw = await request.text();
    if (raw) payload = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: { code: "invalid_body", message: "Invalid request body." } },
      { status: 400 },
    );
  }
  try {
    const created = await createShare(id, {
      includeTranscript:
        typeof payload.includeTranscript === "boolean"
          ? payload.includeTranscript
          : undefined,
      includeHighlights:
        typeof payload.includeHighlights === "boolean"
          ? payload.includeHighlights
          : undefined,
      includeAnalytics:
        typeof payload.includeAnalytics === "boolean"
          ? payload.includeAnalytics
          : undefined,
      expiresInDays:
        typeof payload.expiresInDays === "number"
          ? payload.expiresInDays
          : undefined,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await revokeShare(id);
    return new NextResponse(null, { status: 204 });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
