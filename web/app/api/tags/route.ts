import { NextResponse } from "next/server";
import { createTag, listTags } from "@/lib/api/tags";
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
    return NextResponse.json(await listTags());
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
  if (typeof b.name !== "string" || b.name.trim().length === 0) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "A tag name is required." } },
      { status: 400 },
    );
  }
  try {
    const created = await createTag({
      name: b.name,
      color: typeof b.color === "string" ? b.color : undefined,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
