import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api/client";
import { ApiError, getErrorMessage } from "@/lib/api/error";
import type { MeetingAssist } from "@/lib/api/types";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const result = await apiFetch<MeetingAssist>(`/meetings/${id}/assist`, {
      method: "POST",
    });
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
