import { NextResponse } from "next/server";
import { createInvite, listInvites } from "@/lib/api/workspaces";
import { ApiError, getErrorMessage } from "@/lib/api/error";
import type { InviteRole } from "@/lib/api/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const invites = await listInvites(id);
    return NextResponse.json(invites);
  } catch (error: unknown) {
    const status = ApiError.isApiError(error) ? error.status : 500;
    const code = ApiError.isApiError(error) ? error.code : "internal_error";
    return NextResponse.json(
      { error: { code, message: getErrorMessage(error) } },
      { status },
    );
  }
}

function isCreateBody(
  value: unknown,
): value is { email: string; role: InviteRole } {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.email === "string" &&
    v.email.trim().length > 0 &&
    (v.role === "admin" || v.role === "member")
  );
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
      {
        error: {
          code: "validation_error",
          message: "An email and role (admin or member) are required.",
        },
      },
      { status: 400 },
    );
  }

  try {
    const invite = await createInvite(id, payload.email.trim(), payload.role);
    return NextResponse.json(invite, { status: 201 });
  } catch (error: unknown) {
    const status = ApiError.isApiError(error) ? error.status : 500;
    const code = ApiError.isApiError(error) ? error.code : "internal_error";
    return NextResponse.json(
      { error: { code, message: getErrorMessage(error) } },
      { status },
    );
  }
}
