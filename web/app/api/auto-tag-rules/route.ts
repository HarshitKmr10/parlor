import { NextResponse } from "next/server";
import { createAutoTagRule, listAutoTagRules } from "@/lib/api/autoTag";
import type { AutoTagMatchType } from "@/lib/api/types";
import { ApiError, getErrorMessage } from "@/lib/api/error";

const MATCH_TYPES: AutoTagMatchType[] = ["title_contains", "title_regex"];

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
    return NextResponse.json(await listAutoTagRules());
  } catch (error: unknown) {
    return errorResponse(error);
  }
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
  const b = payload as Record<string, unknown>;
  if (typeof b.pattern !== "string" || b.pattern.trim().length === 0) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "A pattern is required." } },
      { status: 400 },
    );
  }
  const matchType = b.matchType as AutoTagMatchType;
  if (!MATCH_TYPES.includes(matchType)) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "matchType must be title_contains or title_regex." } },
      { status: 400 },
    );
  }
  if (typeof b.tagId !== "string" || b.tagId.trim().length === 0) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "A tag is required." } },
      { status: 400 },
    );
  }
  try {
    const created = await createAutoTagRule({
      pattern: b.pattern,
      matchType,
      tagId: b.tagId,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
