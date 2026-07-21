import { NextResponse } from "next/server";
import { previewRedaction } from "@/lib/api/redaction";
import { ApiError, getErrorMessage } from "@/lib/api/error";

function errorResponse(error: unknown) {
  const status = ApiError.isApiError(error) ? error.status : 500;
  const code = ApiError.isApiError(error) ? error.code : "internal_error";
  return NextResponse.json(
    { error: { code, message: getErrorMessage(error) } },
    { status },
  );
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
  const text = typeof b.text === "string" ? b.text : "";
  try {
    return NextResponse.json(await previewRedaction(text));
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
