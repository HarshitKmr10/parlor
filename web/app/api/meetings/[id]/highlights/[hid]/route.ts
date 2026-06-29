import { NextResponse } from "next/server";
import { deleteHighlight } from "@/lib/api/highlights";
import { ApiError, getErrorMessage } from "@/lib/api/error";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; hid: string }> },
) {
  const { id, hid } = await params;
  try {
    await deleteHighlight(id, hid);
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
