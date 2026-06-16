/**
 * Typed domain entities mirroring docs/API-CONTRACT.md (v1).
 *
 * JSON is camelCase, IDs are UUID strings, timestamps are ISO-8601 UTC.
 * These types are shared by the server-side proxy client and client hooks.
 */

export type WorkspaceRole = "owner" | "admin" | "member";

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  /** Role of the current user within this workspace. */
  role: WorkspaceRole;
}

export type MeetingPlatform = "zoom" | "meet" | "teams";

export type MeetingStatus =
  | "scheduled"
  | "joining"
  | "ongoing"
  | "completed"
  | "failed";

export interface Participant {
  id: string;
  name: string;
  email?: string;
  joinedAt?: string;
  leftAt?: string;
}

export interface Meeting {
  id: string;
  workspaceId: string;
  title: string;
  platform: MeetingPlatform;
  meetingUrl: string;
  status: MeetingStatus;
  scheduledAt?: string;
  startedAt?: string;
  endedAt?: string;
  durationSec?: number;
  participants: Participant[];
  hasSummary: boolean;
  hasRecording: boolean;
  createdAt: string;
}

export interface TranscriptSegment {
  id: string;
  speakerId: string;
  speakerName: string;
  text: string;
  tStartSec: number;
  tEndSec: number;
  createdAt: string;
}

export interface ActionItem {
  id: string;
  text: string;
  assignee?: string;
  dueDate?: string;
  done: boolean;
}

export interface Chapter {
  id: string;
  title: string;
  tStartSec: number;
  tEndSec: number;
}

export interface MeetingInsights {
  summary: string;
  keyPoints: string[];
  actionItems: ActionItem[];
  chapters: Chapter[];
}

export interface Citation {
  segmentId: string;
  speakerName: string;
  text: string;
  tStartSec: number;
}

export type CalendarProvider = "google" | "microsoft";

export interface CalendarAccount {
  id: string;
  provider: CalendarProvider;
  email: string;
  autoJoin: boolean;
  connectedAt: string;
}

export interface ApiKey {
  id: string;
  name: string;
  /** Prefix shown in lists (the full key is returned once on create). */
  prefix: string;
  createdAt: string;
  lastUsedAt?: string;
}

/** Returned once on key creation — the only time the full secret is visible. */
export interface ApiKeyCreated extends ApiKey {
  key: string;
}

/** Detail response augments a meeting with its insights when available. */
export type MeetingDetail = Meeting & { insights?: MeetingInsights };

/** Generic paginated list envelope. */
export interface Paginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface TranscriptResponse {
  items: TranscriptSegment[];
  lastSegmentAt: string | null;
}

export interface AskResponse {
  answer: string;
  citations: Citation[];
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/* ---- Auth payloads ---- */

export interface SignupInput {
  email: string;
  password: string;
  name: string;
  workspaceName: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface SignupResponse extends AuthTokens {
  user: User;
  workspace: Workspace;
}

export interface LoginResponse extends AuthTokens {
  user: User;
}

export type RefreshResponse = AuthTokens;

export interface MeResponse {
  user: User;
  workspaces: Workspace[];
  currentWorkspace: Workspace;
}

/* ---- Meeting create ---- */

export interface CreateMeetingInput {
  meetingUrl: string;
  title?: string;
  scheduledAt?: string;
  botName?: string;
}

/* ---- Error envelope ---- */

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/* ---- Live WebSocket events ---- */

export type LiveEvent =
  | { type: "segment"; segment: TranscriptSegment }
  | { type: "active_speaker"; speakerId: string }
  | { type: "status"; status: MeetingStatus };
