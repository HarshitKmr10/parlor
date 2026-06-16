import { NextResponse } from "next/server";
import { createApiKey, listApiKeys } from "@/lib/api/workspaces";
import { ApiError, getErrorMessage } from "@/lib/api/error";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const keys = await listApiKeys(id);
    return NextResponse.json(keys);
  } catch (error: unknown) {
    const status = ApiError.isApiError(error) ? error.status : 500;
    const code = ApiError.isApiError(error) ? error.code : "internal_error";
    return NextResponse.json(
      { error: { code, message: getErrorMessage(error) } },
      { status },
    );
  }
}

function isCreateBody(value: unknown): value is { name: string } {
  if (typeof value !== "object" || value === null) return false;
  const name = (value as Record<string, unknown>).name;
  return typeof name === "string" && name.trim().length > 0;
}

export async function POST(
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

  if (!isCreateBody(payload)) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "A key name is required." } },
      { status: 400 },
    );
  }

  try {
    const key = await createApiKey(id, payload.name.trim());
    return NextResponse.json(key, { status: 201 });
  } catch (error: unknown) {
    const status = ApiError.isApiError(error) ? error.status : 500;
    const code = ApiError.isApiError(error) ? error.code : "internal_error";
    return NextResponse.json(
      { error: { code, message: getErrorMessage(error) } },
      { status },
    );
  }
}
