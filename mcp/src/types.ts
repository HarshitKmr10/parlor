/**
 * Types mirroring the Parlor backend product API (v1).
 * Source of truth: docs/API-CONTRACT.md. JSON is camelCase, IDs are UUID
 * strings, timestamps are ISO-8601 UTC strings.
 */

export type MeetingPlatform = "zoom" | "meet" | "teams";

export type MeetingStatus =
  | "scheduled"
  | "joining"
  | "ongoing"
  | "completed"
  | "failed";

export interface Participant {
  readonly id: string;
  readonly name: string;
  readonly email?: string;
  readonly joinedAt?: string;
  readonly leftAt?: string;
}

export interface Meeting {
  readonly id: string;
  readonly workspaceId: string;
  readonly title: string;
  readonly platform: MeetingPlatform;
  readonly meetingUrl: string;
  readonly status: MeetingStatus;
  readonly scheduledAt?: string;
  readonly startedAt?: string;
  readonly endedAt?: string;
  readonly durationSec?: number;
  readonly participants: readonly Participant[];
  readonly hasSummary: boolean;
  readonly hasRecording: boolean;
  readonly createdAt: string;
}

export interface ActionItem {
  readonly id: string;
  readonly text: string;
  readonly assignee?: string;
  readonly dueDate?: string;
  readonly done: boolean;
}

export interface Chapter {
  readonly id: string;
  readonly title: string;
  readonly tStartSec: number;
  readonly tEndSec: number;
}

export interface MeetingInsights {
  readonly summary: string;
  readonly keyPoints: readonly string[];
  readonly actionItems: readonly ActionItem[];
  readonly chapters: readonly Chapter[];
}

export type MeetingDetail = Meeting & { readonly insights?: MeetingInsights };

export interface TranscriptSegment {
  readonly id: string;
  readonly speakerId: string;
  readonly speakerName: string;
  readonly text: string;
  readonly tStartSec: number;
  readonly tEndSec: number;
  readonly createdAt: string;
}

export interface Citation {
  readonly segmentId: string;
  readonly speakerName: string;
  readonly text: string;
  readonly tStartSec: number;
}

/** `{ items, total, limit, offset }` paginated list envelope. */
export interface Paginated<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

export interface TranscriptResponse {
  readonly items: readonly TranscriptSegment[];
  readonly lastSegmentAt: string | null;
}

export interface AskResponse {
  readonly answer: string;
  readonly citations: readonly Citation[];
}

/** Error envelope: `{ error: { code, message, details? } }`. */
export interface ApiErrorEnvelope {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: unknown;
  };
}
