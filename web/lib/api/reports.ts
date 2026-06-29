import "server-only";

import { apiFetch } from "./client";
import type { DigestReport } from "./types";

/** Workspace activity rollup over a window (defaults to trailing 7 days). */
export function getDigest(
  params: { from?: string; to?: string } = {},
): Promise<DigestReport> {
  const search = new URLSearchParams();
  if (params.from) search.set("from", params.from);
  if (params.to) search.set("to", params.to);
  const query = search.toString();
  return apiFetch<DigestReport>(`/reports/digest${query ? `?${query}` : ""}`, {
    cache: "no-store",
  });
}
