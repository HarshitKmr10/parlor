import { NextResponse } from "next/server";
import { listIntegrations, upsertIntegration } from "@/lib/api/integrations";
import { ApiError, getErrorMessage } from "@/lib/api/error";
import type { IntegrationKind } from "@/lib/api/types";

function errorResponse(error: unknown) {
  const status = ApiError.isApiError(error) ? error.status : 500;
  const code = ApiError.isApiError(error) ? error.code : "internal_error";
  return NextResponse.json(
    { error: { code, message: getErrorMessage(error) } },
    { status },
  );
}

export async function GET() {
  try {
    return NextResponse.json(await listIntegrations());
  } catch (error: unknown) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
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
  if (typeof b.kind !== "string") {
    return NextResponse.json(
      { error: { code: "validation_error", message: "kind is required." } },
      { status: 400 },
    );
  }
  try {
    const saved = await upsertIntegration({
      kind: b.kind as IntegrationKind,
      enabled: Boolean(b.enabled),
      config: (b.config as Record<string, string>) ?? {},
    });
    return NextResponse.json(saved);
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
