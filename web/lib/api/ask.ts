import "server-only";

import { apiFetch } from "./client";
import type { AskResponse, ChatTurn } from "./types";

/** Workspace-wide RAG Q&A across every meeting in the corpus. */
export function askWorkspace(
  question: string,
  history?: ChatTurn[],
): Promise<AskResponse> {
  return apiFetch<AskResponse>("/ask", {
    method: "POST",
    body: { question, history },
  });
}
