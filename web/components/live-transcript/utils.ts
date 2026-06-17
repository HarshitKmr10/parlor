import type { Speaker, SpeakerTint } from "./types";

/** Tailwind background class for a sage tint. */
export function tintBg(tint: SpeakerTint): string {
  switch (tint) {
    case "sage-300":
      return "bg-sage-300";
    case "sage-400":
      return "bg-sage-400";
    case "sage-500":
      return "bg-sage-500";
  }
}

/** Tailwind text-color class for a sage tint (used for speaker labels). */
export function tintText(tint: SpeakerTint): string {
  switch (tint) {
    case "sage-300":
      // sage-300 is too light for AA text on cream — step to 600.
      return "text-sage-600";
    case "sage-400":
      return "text-sage-700";
    case "sage-500":
      return "text-sage-700";
  }
}

/** Format seconds-from-start as a mono clock label, e.g. 0:07 or 1:02:33. */
export function formatClock(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Index speakers by id for O(1) lookup while rendering. */
export function indexSpeakers(speakers: readonly Speaker[]): Map<string, Speaker> {
  return new Map(speakers.map((speaker) => [speaker.id, speaker]));
}

/** Sage tints assigned to derived speakers in first-seen order, cycling. */
export const SPEAKER_TINTS: SpeakerTint[] = ["sage-500", "sage-400", "sage-300"];

/** Fallback label when a segment carries no speaker name. */
export const UNKNOWN_SPEAKER_NAME = "Speaker";

/**
 * Derive a stable speaker id from a (possibly empty) name. Lowercased and
 * slugified so the same name always maps to the same rail entry across polls.
 */
export function speakerIdFromName(name: string): string {
  const trimmed = name.trim() || UNKNOWN_SPEAKER_NAME;
  const slug = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `spk_${slug || "unknown"}`;
}

/** Two-letter initials from a display name, e.g. "Maya Okonkwo" → "MO". */
export function initialsFromName(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return initials || "?";
}
