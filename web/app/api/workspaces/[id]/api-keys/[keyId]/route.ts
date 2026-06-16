import { NextResponse } from "next/server";
import { revokeApiKey } from "@/lib/api/workspaces";
import { ApiError, getErrorMessage } from "@/lib/api/error";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; keyId: string }> },
) {
  const { id, keyId } = await params;
  try {
    await revokeApiKey(id, keyId);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const status = ApiError.isApiError(error) ? error.status : 500;
    const code = ApiError.isApiError(error) ? error.code : "internal_error";
    return NextResponse.json(
      { error: { code, message: getErrorMessage(error) } },
      { status },
    );
  }
}
