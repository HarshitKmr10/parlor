"use client";

import { useEffect, useMemo, useState } from "react";
import type { TranscriptSegment } from "./types";
import { useMockTranscript } from "./useMockTranscript";

type LiveTranscriptState = {
  segments: TranscriptSegment[];
  activeSpeakerId: string | null;
  elapsedSec: number;
  /** True once a real socket is connected; false while on the mock fallback. */
  isLive: boolean;
};

/**
 * Server WebSocket event shapes (per API-CONTRACT.md). The contract
 * `TranscriptSegment` carries `speakerName`, which the live components don't
 * use (they index speakers by id), so we map to the local segment shape.
 */
type WsSegment = {
  id: string;
  speakerId: string;
  text: string;
  tStartSec: number;
  tEndSec: number;
};

type WsEvent =
  | { type: "segment"; segment: WsSegment }
  | { type: "active_speaker"; speakerId: string }
  | { type: "status"; status: string };

const RECONNECT_DELAY_MS = 2000;
const MAX_RECONNECTS = 3;

function buildSocketUrl(meetingId: string): string | null {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  try {
    const url = new URL(base);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.pathname = `/api/v1/meetings/${meetingId}/live`;
    return url.toString();
  } catch {
    return null;
  }
}

function parseEvent(data: unknown): WsEvent | null {
  if (typeof data !== "string") return null;
  try {
    const parsed = JSON.parse(data) as WsEvent;
    if (parsed && typeof parsed.type === "string") return parsed;
  } catch {
    return null;
  }
  return null;
}

/**
 * Subscribes to the live meeting WebSocket and accumulates segments. When the
 * socket cannot be established (backend down, dev with no WS), it transparently
 * falls back to the scripted mock simulation so the view always animates.
 */
export function useLiveTranscript(meetingId: string): LiveTranscriptState {
  const socketUrl = useMemo(() => buildSocketUrl(meetingId), [meetingId]);

  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  // Start on the fallback when no socket URL can be built; the socket flips
  // this off on open and back on after exhausting reconnects.
  const [useFallback, setUseFallback] = useState(socketUrl === null);

  const mock = useMockTranscript();

  useEffect(() => {
    if (!socketUrl) return;

    let socket: WebSocket | null = null;
    let reconnects = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const clockId = setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);

    const connect = () => {
      if (cancelled) return;
      // socketUrl is validated by buildSocketUrl, so the constructor won't
      // throw synchronously; transport failures surface via onerror/onclose.
      socket = new WebSocket(socketUrl);

      socket.onopen = () => {
        reconnects = 0;
        setUseFallback(false);
      };

      socket.onmessage = (event) => {
        const parsed = parseEvent(event.data);
        if (!parsed) return;
        if (parsed.type === "segment") {
          setSegments((prev) => [...prev, parsed.segment]);
          setActiveSpeakerId(parsed.segment.speakerId);
        } else if (parsed.type === "active_speaker") {
          setActiveSpeakerId(parsed.speakerId);
        }
      };

      socket.onerror = () => {
        socket?.close();
      };

      socket.onclose = () => {
        if (cancelled) return;
        if (reconnects < MAX_RECONNECTS) {
          reconnects += 1;
          reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
        } else {
          // Give up on the socket and animate the mock instead.
          setUseFallback(true);
        }
      };
    };

    connect();

    return () => {
      cancelled = true;
      clearInterval(clockId);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
    };
  }, [socketUrl]);

  if (useFallback) {
    return { ...mock, isLive: false };
  }

  return { segments, activeSpeakerId, elapsedSec, isLive: true };
}
