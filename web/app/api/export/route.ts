import { NextResponse } from "next/server";
import { exportWorkspace } from "@/lib/api/compliance";
import { ApiError, getErrorMessage } from "@/lib/api/error";

/** Streams the workspace data bundle as a downloadable JSON file. */
export async function GET() {
  try {
    const bundle = await exportWorkspace();
    return new NextResponse(JSON.stringify(bundle, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": 'attachment; filename="verdant-export.json"',
      },
    });
  } catch (error: unknown) {
    const status = ApiError.isApiError(error) ? error.status : 500;
    const code = ApiError.isApiError(error) ? error.code : "internal_error";
    return NextResponse.json(
      { error: { code, message: getErrorMessage(error) } },
      { status },
    );
  }
}
