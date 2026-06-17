import { NextResponse } from "next/server";
import {
  getOrgMeetingPolicy,
  putOrgMeetingPolicy,
  type OrgMeetingPolicy,
} from "@/lib/api/google-workspace";
import { ApiError, getErrorMessage } from "@/lib/api/error";

function errorResponse(error: unknown): NextResponse {
  const status = ApiError.isApiError(error) ? error.status : 500;
  const code = ApiError.isApiError(error) ? error.code : "internal_error";
  return NextResponse.json(
    { error: { code, message: getErrorMessage(error) } },
    { status },
  );
}

function isPolicyBody(value: unknown): value is OrgMeetingPolicy {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  const modeOk =
    v.mode === "all" || v.mode === "allowlist" || v.mode === "denylist";
  return modeOk && typeof v.autoJoinEnabled === "boolean";
}

export async function GET() {
  try {
    const policy = await getOrgMeetingPolicy();
    return NextResponse.json(policy);
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

  if (!isPolicyBody(payload)) {
    return NextResponse.json(
      {
        error: {
          code: "validation_error",
          message: "autoJoinEnabled and a valid mode are required.",
        },
      },
      { status: 400 },
    );
  }

  try {
    const policy = await putOrgMeetingPolicy(payload);
    return NextResponse.json(policy);
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
