import { NextResponse } from "next/server";
import { createPrompt, listPrompts } from "@/lib/api/prompts";
import { ApiError, getErrorMessage } from "@/lib/api/error";

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
    return NextResponse.json(await listPrompts());
  } catch (error: unknown) {
    return errorResponse(error);
  }
}

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
  const b = payload as Record<string, unknown>;
  if (typeof b.title !== "string" || b.title.trim().length === 0) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "A prompt title is required." } },
      { status: 400 },
    );
  }
  if (typeof b.body !== "string" || b.body.trim().length === 0) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "A prompt body is required." } },
      { status: 400 },
    );
  }
  try {
    const created = await createPrompt({ title: b.title, body: b.body });
    return NextResponse.json(created, { status: 201 });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
