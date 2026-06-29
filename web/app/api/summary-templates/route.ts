import { NextResponse } from "next/server";
import { createTemplate } from "@/lib/api/summary-templates";
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
  if (typeof body.name !== "string" || body.name.trim().length === 0) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "A template name is required." } },
      { status: 400 },
    );
  }
  try {
    const created = await createTemplate({
      name: body.name,
      instructions: typeof body.instructions === "string" ? body.instructions : "",
      sections: Array.isArray(body.sections) ? (body.sections as string[]) : undefined,
      isDefault: typeof body.isDefault === "boolean" ? body.isDefault : undefined,
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
