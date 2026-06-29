import { NextResponse } from "next/server";
import { listNotifications } from "@/lib/api/notifications";
import { ApiError, getErrorMessage } from "@/lib/api/error";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const unreadOnly = url.searchParams.get("unreadOnly") === "true";
  try {
    const result = await listNotifications({ unreadOnly, limit: 50 });
    return NextResponse.json(result);
  } catch (error: unknown) {
    const status = ApiError.isApiError(error) ? error.status : 500;
    const code = ApiError.isApiError(error) ? error.code : "internal_error";
    return NextResponse.json(
      { error: { code, message: getErrorMessage(error) } },
      { status },
    );
  }
}
