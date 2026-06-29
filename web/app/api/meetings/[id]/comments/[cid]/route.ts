import { NextResponse } from "next/server";
import { deleteComment, updateComment } from "@/lib/api/comments";
import { ApiError, getErrorMessage } from "@/lib/api/error";

function errorResponse(error: unknown) {
  const status = ApiError.isApiError(error) ? error.status : 500;
  const code = ApiError.isApiError(error) ? error.code : "internal_error";
  return NextResponse.json(
    { error: { code, message: getErrorMessage(error) } },
    { status },
  );
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; cid: string }> },
) {
  const { id, cid } = await params;
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
  try {
    const updated = await updateComment(id, cid, {
      body: typeof body.body === "string" ? body.body : undefined,
      resolved: typeof body.resolved === "boolean" ? body.resolved : undefined,
    });
    return NextResponse.json(updated);
  } catch (error: unknown) {
    return errorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; cid: string }> },
) {
  const { id, cid } = await params;
  try {
    await deleteComment(id, cid);
    return new NextResponse(null, { status: 204 });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
