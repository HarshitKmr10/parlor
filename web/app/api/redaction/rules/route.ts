import { NextResponse } from "next/server";
import { createRedactionRule, listRedactionRules } from "@/lib/api/redaction";
import type { RedactionRuleKind } from "@/lib/api/types";
import { ApiError, getErrorMessage } from "@/lib/api/error";

const KINDS: RedactionRuleKind[] = ["builtin", "regex", "keyword"];

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
    return NextResponse.json(await listRedactionRules());
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
  if (typeof b.name !== "string" || b.name.trim().length === 0) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "A rule name is required." } },
      { status: 400 },
    );
  }
  const kind = b.kind as RedactionRuleKind;
  if (!KINDS.includes(kind)) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "kind must be builtin, regex, or keyword." } },
      { status: 400 },
    );
  }
  if (typeof b.pattern !== "string" || b.pattern.trim().length === 0) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "A pattern is required." } },
      { status: 400 },
    );
  }
  try {
    const created = await createRedactionRule({
      name: b.name,
      kind,
      pattern: b.pattern,
      replacement: typeof b.replacement === "string" ? b.replacement : undefined,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
