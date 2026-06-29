import { NextResponse } from "next/server";
import { askWorkspace } from "@/lib/api/ask";
import { ApiError, getErrorMessage } from "@/lib/api/error";
import type { ChatTurn } from "@/lib/api/types";

type AskBody = { question: string; history?: ChatTurn[] };

function isAskBody(value: unknown): value is AskBody {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>).question === "string"
  );
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "invalid_body", message: "Invalid request body." } },
      { status: 400 },
    );
  }
  if (!isAskBody(payload) || payload.question.trim().length === 0) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "A question is required." } },
      { status: 400 },
    );
  }
  try {
    const result = await askWorkspace(payload.question, payload.history);
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
