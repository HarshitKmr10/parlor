import { NextResponse } from "next/server";
import { deleteRedactionRule, updateRedactionRule } from "@/lib/api/redaction";
import type { RedactionRuleKind } from "@/lib/api/types";
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
  const b = payload as Record<string, unknown>;
  try {
    const updated = await updateRedactionRule(id, {
      name: typeof b.name === "string" ? b.name : undefined,
      kind: typeof b.kind === "string" ? (b.kind as RedactionRuleKind) : undefined,
      pattern: typeof b.pattern === "string" ? b.pattern : undefined,
      replacement: typeof b.replacement === "string" ? b.replacement : undefined,
      enabled: typeof b.enabled === "boolean" ? b.enabled : undefined,
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
    await deleteRedactionRule(id);
    return new NextResponse(null, { status: 204 });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
