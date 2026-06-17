"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Speaker, TranscriptSegment } from "./types";
import type {
  MeetingStatus,
  MeetingStatusResponse,
  TranscriptResponse,
} from "@/lib/api/types";
import { getJson } from "@/lib/api/browser";
import {
  initialsFromName,
  speakerIdFromName,
  SPEAKER_TINTS,
  UNKNOWN_SPEAKER_NAME,
} from "./utils";

type LiveTranscriptState = {
  segments: TranscriptSegment[];
  /** Speakers derived from the polled segments (real participants). */
  speakers: Speaker[];
  activeSpeakerId: string | null;
  elapsedSec: number;
  /** Current meeting status (kept fresh by the status poll). */
  status: MeetingStatus;
  /** True while the meeting is `joining`/`ongoing` (REC + clock running). */
  isOngoing: boolean;
};

/** How often to poll the transcript + status route handlers. */
const POLL_INTERVAL_MS = 2500;

/** Statuses for which the meeting is still being captured live. */
function isOngoingStatus(status: MeetingStatus): boolean {
  return status === "joining" || status === "ongoing";
}

/**
 * Backend transcript segment shape (per API-CONTRACT.md) as returned by the
 * same-origin `/api/meetings/{id}/transcript` route handler.
 */
type BackendSegment = {
  id: string;
  speakerId?: string;
  speakerName?: string;
  text: string;
  tStartSec: number;
  tEndSec: number;
  createdAt: string;
};

/**
 * Map a backend segment to the local view-model segment. The local components
 * index speakers by id, so we synthesize a stable id from the speaker name
 * (grouping all of a speaker's lines onto one rail entry).
 */
function toViewSegment(segment: BackendSegment): TranscriptSegment {
  const name = segment.speakerName?.trim() || UNKNOWN_SPEAKER_NAME;
  return {
    id: segment.id,
    speakerId: speakerIdFromName(name),
    text: segment.text,
    tStartSec: segment.tStartSec,
    tEndSec: segment.tEndSec,
  };
}

/**
 * Derive the speaker list from accumulated segments. Speakers are surfaced in
 * first-seen order and assigned sage tints by that order (cycling). Each
 * speaker's id is stable across polls so the rail does not reshuffle.
 */
function deriveSpeakers(rawByName: Map<string, string>): Speaker[] {
  let index = 0;
  const speakers: Speaker[] = [];
  for (const [id, name] of rawByName) {
    speakers.push({
      id,
      name,
      initials: initialsFromName(name),
      sageTint: SPEAKER_TINTS[index % SPEAKER_TINTS.length],
    });
    index += 1;
  }
  return speakers;
}

/**
 * Polls the authenticated transcript + status route handlers and accumulates
 * real segments. Speakers are derived dynamically from the segments
 * themselves, so the rail and stream show the real participants — there is no
 * mock fallback (the authenticated live view shows real data or an empty
 * state, never fabricated people).
 *
 * Status awareness: the status poll keeps `status`/`isOngoing` fresh. While
 * the meeting is `joining`/`ongoing` the elapsed clock ticks and both polls
 * continue. Once the meeting flips to `completed`/`failed`, the clock freezes,
 * transcript polling stops (captured segments stay visible, read-only), and
 * the view switches to its "meeting ended" state.
 */
export function useLiveTranscript(
  meetingId: string,
  initialStatus: MeetingStatus,
): LiveTranscriptState {
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  // First-seen order of speakers: id -> display name. State so renders update.
  const [speakerNames, setSpeakerNames] = useState<Map<string, string>>(
    () => new Map(),
  );
  const [status, setStatus] = useState<MeetingStatus>(initialStatus);

  const ongoing = isOngoingStatus(status);

  // Refs the polling loop reads without re-arming the interval each render.
  const sinceRef = useRef<string | undefined>(undefined);
  const inFlightRef = useRef(false);
  const seenIdsRef = useRef<Set<string>>(new Set());
  // Mirror of `ongoing` for the polling closures so they can self-terminate
  // without re-arming the interval. Kept in sync via an effect (writing a ref
  // during render is disallowed).
  const ongoingRef = useRef(ongoing);
  useEffect(() => {
    ongoingRef.current = ongoing;
  }, [ongoing]);

  // 1Hz wall clock for the elapsed-time readout — only while ongoing so the
  // "live" timer freezes the moment the meeting ends.
  useEffect(() => {
    if (!ongoing) return;
    const clockId = setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(clockId);
  }, [ongoing]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const pollTranscript = async () => {
      if (cancelled || inFlightRef.current) return;
      inFlightRef.current = true;

      const query = sinceRef.current
        ? `?since=${encodeURIComponent(sinceRef.current)}`
        : "";
      const url = `/api/meetings/${meetingId}/transcript${query}`;

      try {
        const data = await getJson<TranscriptResponse>(url, controller.signal);
        if (cancelled) return;

        const incoming = (data.items ?? []) as unknown as BackendSegment[];
        const fresh = incoming.filter((s) => !seenIdsRef.current.has(s.id));

        if (fresh.length > 0) {
          for (const s of fresh) seenIdsRef.current.add(s.id);
          const mapped = fresh.map(toViewSegment);

          setSegments((prev) => [...prev, ...mapped]);
          setActiveSpeakerId(mapped[mapped.length - 1].speakerId);

          setSpeakerNames((prev) => {
            let changed = false;
            const next = new Map(prev);
            for (const s of fresh) {
              const name = s.speakerName?.trim() || UNKNOWN_SPEAKER_NAME;
              const id = speakerIdFromName(name);
              if (!next.has(id)) {
                next.set(id, name);
                changed = true;
              }
            }
            return changed ? next : prev;
          });
        }

        // Advance the cursor so the next poll only fetches newer segments.
        if (data.lastSegmentAt) sinceRef.current = data.lastSegmentAt;
      } catch (error: unknown) {
        if (cancelled) return;
        // Ignore aborts and transient errors; the next tick retries. No mock
        // fallback — the empty/ended states cover the no-data case honestly.
        if (error instanceof DOMException && error.name === "AbortError") return;
      } finally {
        inFlightRef.current = false;
      }
    };

    const pollStatus = async () => {
      if (cancelled) return;
      try {
        const data = await getJson<MeetingStatusResponse>(
          `/api/meetings/${meetingId}`,
          controller.signal,
        );
        if (cancelled || !data.status) return;
        setStatus(data.status);
      } catch (error: unknown) {
        if (cancelled) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        // Status poll failures are non-fatal; keep the last known status.
      }
    };

    const tick = () => {
      void pollStatus();
      // Stop fetching new segments once the meeting is no longer live; the
      // already-captured transcript stays on screen (read-only).
      if (ongoingRef.current) void pollTranscript();
    };

    // Always do an initial fetch so a meeting that ended before mount still
    // shows its captured transcript.
    void pollStatus();
    void pollTranscript();

    const pollId = setInterval(tick, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(pollId);
    };
  }, [meetingId]);

  const speakers = useMemo(
    () => deriveSpeakers(speakerNames),
    [speakerNames],
  );

  return {
    segments,
    speakers,
    activeSpeakerId,
    elapsedSec,
    status,
    isOngoing: ongoing,
  };
}
