import { NextResponse } from "next/server";
import { getConfigExport } from "@/lib/api/configExport";
import { ApiError, getErrorMessage } from "@/lib/api/error";

/** Returns the workspace Parlor configuration as JSON (403 envelope passes through). */
export async function GET() {
  try {
    return NextResponse.json(await getConfigExport());
  } catch (error: unknown) {
    const status = ApiError.isApiError(error) ? error.status : 500;
    const code = ApiError.isApiError(error) ? error.code : "internal_error";
    return NextResponse.json(
      { error: { code, message: getErrorMessage(error) } },
      { status },
    );
  }
}
