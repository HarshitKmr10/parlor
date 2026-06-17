"use client";

import { useEffect, useRef, useState } from "react";
import type { Speaker, TranscriptSegment } from "./types";
import { MOCK_SPEAKERS, SCRIPTED_SEGMENTS } from "./mockData";

type Options = {
  /** Milliseconds between emitted segments. */
  intervalMs?: number;
};

type MockTranscriptState = {
  segments: TranscriptSegment[];
  /** The four seeded mock participants. */
  speakers: Speaker[];
  activeSpeakerId: string | null;
  elapsedSec: number;
};

const DEFAULT_INTERVAL_MS = 3200;

/**
 * Replays the scripted product meeting on an interval, emitting one new
 * `TranscriptSegment` per tick and rotating the active speaker. Each segment
 * is re-stamped with a live monotonic clock so timestamps stay consistent
 * with `elapsedSec`. The interval is cleaned up on unmount.
 *
 * Replace this hook with a WebSocket subscription that pushes real
 * `TranscriptSegment` values; the consuming components do not change.
 */
export function useMockTranscript({
  intervalMs = DEFAULT_INTERVAL_MS,
}: Options = {}): MockTranscriptState {
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);

  // Index into the scripted beats; a ref so it survives re-renders without
  // re-arming the interval.
  const cursorRef = useRef(0);

  useEffect(() => {
    // Drive a 1Hz wall clock for the elapsed-time readout.
    const clockId = setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);

    const emit = () => {
      const cursor = cursorRef.current;
      const beat = SCRIPTED_SEGMENTS[cursor % SCRIPTED_SEGMENTS.length];
      const loop = Math.floor(cursor / SCRIPTED_SEGMENTS.length);
      // Offset times per loop so a replay does not collide with prior stamps.
      const loopOffset = loop * 100;

      const segment: TranscriptSegment = {
        id: `seg_${cursor}`,
        speakerId: beat.speakerId,
        text: beat.text,
        tStartSec: beat.tStartSec + loopOffset,
        tEndSec: beat.tEndSec + loopOffset,
      };

      setSegments((prev) => [...prev, segment]);
      setActiveSpeakerId(beat.speakerId);
      cursorRef.current = cursor + 1;
    };

    // Emit the first beat immediately so the view is never empty.
    emit();
    const emitId = setInterval(emit, intervalMs);

    return () => {
      clearInterval(emitId);
      clearInterval(clockId);
    };
  }, [intervalMs]);

  return { segments, speakers: MOCK_SPEAKERS, activeSpeakerId, elapsedSec };
}
