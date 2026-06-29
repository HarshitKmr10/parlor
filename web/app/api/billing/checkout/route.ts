import { NextResponse } from "next/server";
import { checkout } from "@/lib/api/billing";
import { ApiError, getErrorMessage } from "@/lib/api/error";

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
  const plan = (payload as { plan?: string }).plan;
  if (plan !== "pro" && plan !== "business") {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Choose the pro or business plan." } },
      { status: 400 },
    );
  }
  try {
    return NextResponse.json(await checkout(plan));
  } catch (error: unknown) {
    // A configured Stripe returns a 303 with the redirect URL in the message.
    if (ApiError.isApiError(error) && error.status === 303) {
      return NextResponse.json({ redirectUrl: getErrorMessage(error) }, { status: 200 });
    }
    const status = ApiError.isApiError(error) ? error.status : 500;
    const code = ApiError.isApiError(error) ? error.code : "internal_error";
    return NextResponse.json(
      { error: { code, message: getErrorMessage(error) } },
      { status },
    );
  }
}
