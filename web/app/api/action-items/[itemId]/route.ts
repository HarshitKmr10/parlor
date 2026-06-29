import { NextResponse } from "next/server";
import { deleteActionItem, updateActionItem } from "@/lib/api/action-items";
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
  { params }: { params: Promise<{ itemId: string }> },
) {
  const { itemId } = await params;
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
    const updated = await updateActionItem(itemId, {
      done: typeof body.done === "boolean" ? body.done : undefined,
      assignee: typeof body.assignee === "string" ? body.assignee : undefined,
      text: typeof body.text === "string" ? body.text : undefined,
      dueDate: typeof body.dueDate === "string" ? body.dueDate : undefined,
    });
    return NextResponse.json(updated);
  } catch (error: unknown) {
    return errorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const { itemId } = await params;
  try {
    await deleteActionItem(itemId);
    return new NextResponse(null, { status: 204 });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
