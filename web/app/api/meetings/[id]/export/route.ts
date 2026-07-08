import "server-only";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  ACCESS_TOKEN_COOKIE,
  WORKSPACE_COOKIE,
  backendUrl,
} from "@/lib/api/config";

/**
 * Same-origin proxy for the meeting export download. Unlike the other
 * `[id]/*` route handlers, this one can't go through `apiFetch` — that client
 * always parses the response as JSON, but an export is a raw file download
 * (`text/markdown`, `Content-Disposition: attachment`). Instead this streams
 * the backend response body straight through, forwarding only the headers
 * the browser needs to trigger a download.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const format = new URL(request.url).searchParams.get("format") ?? "markdown";

  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  const workspaceId = cookieStore.get(WORKSPACE_COOKIE)?.value;

  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (workspaceId) headers["X-Workspace-Id"] = workspaceId;

  let upstream: Response;
  try {
    upstream = await fetch(
      backendUrl(`/meetings/${id}/export?format=${encodeURIComponent(format)}`),
      { headers, cache: "no-store" },
    );
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "backend_unavailable",
          message: "The backend is not reachable.",
        },
      },
      { status: 503 },
    );
  }

  if (!upstream.ok) {
    const text = await upstream.text();
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }
    return NextResponse.json(
      body ?? {
        error: {
          code: "export_failed",
          message: `Export failed with status ${upstream.status}.`,
        },
      },
      { status: upstream.status },
    );
  }

  const contentType = upstream.headers.get("content-type") ?? "text/markdown";
  const disposition = upstream.headers.get("content-disposition");
  const responseHeaders: Record<string, string> = { "Content-Type": contentType };
  if (disposition) responseHeaders["Content-Disposition"] = disposition;

  return new NextResponse(upstream.body, { status: 200, headers: responseHeaders });
}
