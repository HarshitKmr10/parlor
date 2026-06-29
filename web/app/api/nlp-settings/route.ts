import { NextResponse } from "next/server";
import { getNlpSettings, putNlpSettings } from "@/lib/api/nlp";
import { ApiError, getErrorMessage } from "@/lib/api/error";
import type { NlpSettings } from "@/lib/api/types";

function errorResponse(error: unknown) {
  const status = ApiError.isApiError(error) ? error.status : 500;
  const code = ApiError.isApiError(error) ? error.code : "internal_error";
  return NextResponse.json(
    { error: { code, message: getErrorMessage(error) } },
    { status },
  );
}

export async function GET() {
  try {
    return NextResponse.json(await getNlpSettings());
  } catch (error: unknown) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "invalid_body", message: "Invalid request body." } },
      { status: 400 },
    );
  }
  const b = payload as Partial<NlpSettings>;
  try {
    const saved = await putNlpSettings({
      redactionEnabled: Boolean(b.redactionEnabled),
      redactEmails: b.redactEmails !== false,
      redactPhones: b.redactPhones !== false,
      redactCards: b.redactCards !== false,
      customVocab: Array.isArray(b.customVocab) ? b.customVocab : [],
    });
    return NextResponse.json(saved);
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
