/**
 * Shared domain types for the live meeting / transcript surface.
 *
 * These are intentionally transport-agnostic: a real WebSocket transcript
 * stream can emit `TranscriptSegment` values that drop straight into the
 * same components that the mock simulation feeds today.
 */

/** Sage scale tints permitted for speaker identity. Gold is reserved. */
export type SpeakerTint = "sage-300" | "sage-400" | "sage-500";

export type Speaker = {
  id: string;
  name: string;
  initials: string;
  sageTint: SpeakerTint;
};

export type TranscriptSegment = {
  id: string;
  speakerId: string;
  text: string;
  /** Seconds from meeting start that this segment began. */
  tStartSec: number;
  /** Seconds from meeting start that this segment ended. */
  tEndSec: number;
};

export type MeetingMeta = {
  id: string;
  title: string;
  /** ISO timestamp the meeting started. */
  startedAt: string;
  participants: Speaker[];
};

export type ActionItem = {
  id: string;
  text: string;
  /** Speaker the item was assigned to, if any. */
  ownerId?: string;
  /** Seconds from meeting start the item surfaced. */
  tSec: number;
};

/** A single cited snippet returned by an "ask this meeting" answer. */
export type Citation = {
  segmentId: string;
  speakerId: string;
  text: string;
  tSec: number;
};

/** The shape an answer (mocked now, model-backed later) resolves to. */
export type AskAnswer = {
  question: string;
  answer: string;
  citations: Citation[];
};
