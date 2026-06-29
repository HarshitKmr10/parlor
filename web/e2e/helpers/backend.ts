/**
 * Direct backend client for E2E seeding.
 *
 * The web UI talks to the backend through same-origin Next route handlers, but
 * for *seeding* test data we hit the FastAPI product API (:8000) and the
 * ai-service (:8100) straight, plus one `psql` write for the transcript (the
 * backend has no transcript-ingest API — a live bot would populate it).
 *
 * Everything here mirrors `scripts/smoke_e2e.sh` but in typed TS so the
 * Playwright suite can build a realistic, multi-meeting workspace on demand.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const BACKEND_URL = process.env.PW_BACKEND_URL ?? "http://localhost:8000";
export const AI_URL = process.env.PW_AI_URL ?? "http://localhost:8100";
export const DB_DSN =
  process.env.PW_DB_DSN ?? "postgresql://meeting:meeting@localhost:5432/verdant";

const API = `${BACKEND_URL}/api/v1`;

export interface Account {
  email: string;
  password: string;
  name: string;
  token: string;
  workspaceId: string;
  userId: string;
}

export interface TranscriptSegment {
  id: string;
  speaker: string;
  speakerId: string;
  text: string;
  startTime: number;
  endTime: number;
}

async function req<T>(
  path: string,
  init: RequestInit & { token?: string; workspaceId?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };
  if (init.token) headers["Authorization"] = `Bearer ${init.token}`;
  if (init.workspaceId) headers["X-Workspace-Id"] = init.workspaceId;
  const res = await fetch(`${API}${path}`, { ...init, headers });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${init.method ?? "GET"} ${path} -> ${res.status}: ${text}`);
  }
  return (text ? JSON.parse(text) : undefined) as T;
}

/** Sign a brand-new workspace + owner up. */
export async function signup(opts: {
  email: string;
  password: string;
  name: string;
  workspaceName: string;
}): Promise<Account> {
  const body = await req<{
    accessToken: string;
    user: { id: string };
    workspace: { id: string };
  }>("/auth/signup", { method: "POST", body: JSON.stringify(opts) });
  return {
    email: opts.email,
    password: opts.password,
    name: opts.name,
    token: body.accessToken,
    workspaceId: body.workspace.id,
    userId: body.user.id,
  };
}

export interface Meeting {
  id: string;
  title: string;
  platform: string;
  status: string;
}

export async function createMeeting(
  acct: Account,
  input: { meetingUrl: string; title: string; botName?: string },
): Promise<Meeting> {
  return req<Meeting>("/meetings", {
    method: "POST",
    token: acct.token,
    workspaceId: acct.workspaceId,
    body: JSON.stringify(input),
  });
}

/**
 * Seed a transcript directly into `meeting_joiner.transcript` via psql, exactly
 * like the smoke script. Dollar-quoting avoids all JSON escaping headaches.
 */
export function seedTranscript(
  meetingId: string,
  segments: TranscriptSegment[],
): void {
  const last = segments[segments.length - 1];
  const transcript = {
    content: segments.map((s) => ({
      ...s,
      timestamp: new Date(2026, 5, 16).toISOString(),
      session_number: 1,
    })),
    lastSegmentTime: new Date(2026, 5, 16).toISOString(),
    totalSegments: segments.length,
    durationSec: last ? last.endTime : 0,
  };
  const sql = `UPDATE meeting_joiner
     SET transcript = $json$${JSON.stringify(transcript)}$json$::json,
         status = 'completed',
         updated_at = now()
     WHERE id = '${meetingId}'::uuid;`;
  const dir = mkdtempSync(join(tmpdir(), "seed-"));
  const file = join(dir, "seed.sql");
  writeFileSync(file, sql);
  const out = execFileSync("psql", [DB_DSN, "-v", "ON_ERROR_STOP=1", "-f", file], {
    encoding: "utf8",
  });
  if (!out.includes("UPDATE 1")) {
    throw new Error(`transcript seed for ${meetingId} did not update a row: ${out}`);
  }
}

/** Generate summary/insights (backend -> ai-service mock). */
export async function summarize(acct: Account, meetingId: string): Promise<unknown> {
  return req(`/meetings/${meetingId}/summarize`, {
    method: "POST",
    token: acct.token,
    workspaceId: acct.workspaceId,
  });
}

/** Seed pgvector embeddings via the ai-service so RAG ask + search have data. */
export async function embed(
  acct: Account,
  meetingId: string,
  segments: TranscriptSegment[],
): Promise<void> {
  const res = await fetch(`${AI_URL}/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      workspaceId: acct.workspaceId,
      meetingId,
      segments: segments.map((s) => ({
        id: s.id,
        speakerId: s.speakerId,
        speakerName: s.speaker,
        text: s.text,
        tStartSec: s.startTime,
        tEndSec: s.endTime,
      })),
    }),
  });
  if (!res.ok) throw new Error(`embed -> ${res.status}: ${await res.text()}`);
}

export async function createHighlight(
  acct: Account,
  meetingId: string,
  body: { tStartSec: number; tEndSec: number; label?: string; note?: string; color?: string },
): Promise<{ id: string }> {
  return req(`/meetings/${meetingId}/highlights`, {
    method: "POST",
    token: acct.token,
    workspaceId: acct.workspaceId,
    body: JSON.stringify(body),
  });
}

export async function createComment(
  acct: Account,
  meetingId: string,
  body: { body: string; anchorTSec?: number },
): Promise<{ id: string }> {
  return req(`/meetings/${meetingId}/comments`, {
    method: "POST",
    token: acct.token,
    workspaceId: acct.workspaceId,
    body: JSON.stringify(body),
  });
}

export async function createActionItem(
  acct: Account,
  meetingId: string,
  body: { text: string; assignee?: string; dueDate?: string },
): Promise<{ id: string }> {
  return req(`/meetings/${meetingId}/action-items`, {
    method: "POST",
    token: acct.token,
    workspaceId: acct.workspaceId,
    body: JSON.stringify(body),
  });
}

export async function createShare(
  acct: Account,
  meetingId: string,
  body: { includeTranscript?: boolean; includeHighlights?: boolean; includeAnalytics?: boolean } = {},
): Promise<{ token: string; path: string }> {
  return req(`/meetings/${meetingId}/share`, {
    method: "POST",
    token: acct.token,
    workspaceId: acct.workspaceId,
    body: JSON.stringify(body),
  });
}
