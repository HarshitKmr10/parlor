import { NextResponse } from "next/server";
import {
  createHighlight,
  listMeetingHighlights,
} from "@/lib/api/highlights";
import { ApiError, getErrorMessage } from "@/lib/api/error";

function errorResponse(error: unknown) {
  const status = ApiError.isApiError(error) ? error.status : 500;
  const code = ApiError.isApiError(error) ? error.code : "internal_error";
  return NextResponse.json(
    { error: { code, message: getErrorMessage(error) } },
    { status },
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    return NextResponse.json(await listMeetingHighlights(id));
  } catch (error: unknown) {
    return errorResponse(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "invalid_body", message: "Invalid request body." } },
      { status: 400 },
    );
  }
  const body = payload as Record<string, unknown>;
  if (typeof body.tStartSec !== "number" || typeof body.tEndSec !== "number") {
    return NextResponse.json(
      {
        error: {
          code: "validation_error",
          message: "tStartSec and tEndSec are required.",
        },
      },
      { status: 400 },
    );
  }
  try {
    const created = await createHighlight(id, {
      tStartSec: body.tStartSec,
      tEndSec: body.tEndSec,
      label: typeof body.label === "string" ? body.label : undefined,
      note: typeof body.note === "string" ? body.note : undefined,
      color: typeof body.color === "string" ? body.color : undefined,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
