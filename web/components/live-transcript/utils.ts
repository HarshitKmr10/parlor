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
