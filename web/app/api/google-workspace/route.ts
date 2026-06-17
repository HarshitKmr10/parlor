import { NextResponse } from "next/server";
import {
  configureGoogleWorkspace,
  deleteGoogleWorkspace,
  getGoogleWorkspaceConfig,
  type GoogleWorkspaceConfigRequest,
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

function isConfigBody(value: unknown): value is GoogleWorkspaceConfigRequest {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  const modeOk = v.authMode === "dwd" || v.authMode === "marketplace";
  return modeOk && typeof v.enabled === "boolean";
}

export async function GET() {
  try {
    const config = await getGoogleWorkspaceConfig();
    return NextResponse.json(config);
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

  if (!isConfigBody(payload)) {
    return NextResponse.json(
      {
        error: {
          code: "validation_error",
          message: "authMode and enabled are required.",
        },
      },
      { status: 400 },
    );
  }

  try {
    const config = await configureGoogleWorkspace(payload);
    return NextResponse.json(config);
  } catch (error: unknown) {
    return errorResponse(error);
  }
}

export async function DELETE() {
  try {
    const result = await deleteGoogleWorkspace();
    return NextResponse.json(result);
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
