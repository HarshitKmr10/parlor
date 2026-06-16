import { NextResponse } from "next/server";
import { setActiveWorkspace } from "@/lib/auth/session";

function isSwitchInput(value: unknown): value is { workspaceId: string } {
  if (typeof value !== "object" || value === null) return false;
  return typeof (value as Record<string, unknown>).workspaceId === "string";
}

/** Switch the active workspace (sets the readable workspace cookie). */
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

  if (!isSwitchInput(payload)) {
    return NextResponse.json(
      {
        error: {
          code: "validation_error",
          message: "workspaceId is required.",
        },
      },
      { status: 400 },
    );
  }

  await setActiveWorkspace(payload.workspaceId);
  return NextResponse.json({ ok: true });
}
