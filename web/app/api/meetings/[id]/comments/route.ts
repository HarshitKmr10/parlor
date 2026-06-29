import { NextResponse } from "next/server";
import { createComment, listComments } from "@/lib/api/comments";
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
    return NextResponse.json(await listComments(id));
  } catch (error: unknown) {
    return errorResponse(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "invalid_body", message: "Invalid request body." } },
      { status: 400 },
    );
  }
  const body = payload as Record<string, unknown>;
  if (typeof body.body !== "string" || body.body.trim().length === 0) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "A comment body is required." } },
      { status: 400 },
    );
  }
  try {
    const created = await createComment(id, {
      body: body.body,
      anchorTSec: typeof body.anchorTSec === "number" ? body.anchorTSec : undefined,
      anchorSegmentId:
        typeof body.anchorSegmentId === "string" ? body.anchorSegmentId : undefined,
      parentId: typeof body.parentId === "string" ? body.parentId : undefined,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
