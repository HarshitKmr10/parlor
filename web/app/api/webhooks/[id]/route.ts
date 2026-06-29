import { NextResponse } from "next/server";
import { deleteWebhook, updateWebhook } from "@/lib/api/webhooks";
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
  try {
    const updated = await updateWebhook(id, {
      enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
      url: typeof body.url === "string" ? body.url : undefined,
      description: typeof body.description === "string" ? body.description : undefined,
      eventTypes: Array.isArray(body.eventTypes) ? (body.eventTypes as string[]) : undefined,
    });
    return NextResponse.json(updated);
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
    await deleteWebhook(id);
    return new NextResponse(null, { status: 204 });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
