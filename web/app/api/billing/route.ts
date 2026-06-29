import { NextResponse } from "next/server";
import { getBilling } from "@/lib/api/billing";
import { ApiError, getErrorMessage } from "@/lib/api/error";

export async function GET() {
  try {
    return NextResponse.json(await getBilling());
  } catch (error: unknown) {
    const status = ApiError.isApiError(error) ? error.status : 500;
    const code = ApiError.isApiError(error) ? error.code : "internal_error";
    return NextResponse.json(
      { error: { code, message: getErrorMessage(error) } },
      { status },
    );
  }
}
