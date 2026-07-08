import { NextResponse } from "next/server";
import { previewInvite } from "@/lib/api/invites";
import { ApiError, getErrorMessage } from "@/lib/api/error";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  try {
    const preview = await previewInvite(token);
    return NextResponse.json(preview);
  } catch (error: unknown) {
    const status = ApiError.isApiError(error) ? error.status : 500;
    const code = ApiError.isApiError(error) ? error.code : "internal_error";
    return NextResponse.json(
      { error: { code, message: getErrorMessage(error) } },
      { status },
    );
  }
}
