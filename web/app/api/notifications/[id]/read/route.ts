import { NextResponse } from "next/server";
import { markNotificationRead } from "@/lib/api/notifications";
import { ApiError, getErrorMessage } from "@/lib/api/error";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await markNotificationRead(id);
    return new NextResponse(null, { status: 204 });
  } catch (error: unknown) {
    const status = ApiError.isApiError(error) ? error.status : 500;
    const code = ApiError.isApiError(error) ? error.code : "internal_error";
    return NextResponse.json(
      { error: { code, message: getErrorMessage(error) } },
      { status },
    );
  }
}
