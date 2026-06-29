import { NextResponse } from "next/server";
import { createWebhook } from "@/lib/api/webhooks";
import { ApiError, getErrorMessage } from "@/lib/api/error";

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
  const body = payload as Record<string, unknown>;
  if (typeof body.url !== "string" || body.url.trim().length === 0) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "A URL is required." } },
      { status: 400 },
    );
  }
  try {
    const created = await createWebhook({
      url: body.url,
      description: typeof body.description === "string" ? body.description : undefined,
      eventTypes: Array.isArray(body.eventTypes) ? (body.eventTypes as string[]) : undefined,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error: unknown) {
    const status = ApiError.isApiError(error) ? error.status : 500;
    const code = ApiError.isApiError(error) ? error.code : "internal_error";
    return NextResponse.json(
      { error: { code, message: getErrorMessage(error) } },
      { status },
    );
  }
}
