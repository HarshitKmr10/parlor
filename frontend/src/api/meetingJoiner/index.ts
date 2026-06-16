/**
 * Typed wrappers for the meeting-joiner FastAPI service.
 *
 * The backend lives at $NEXT_PUBLIC_MEETING_JOINER_API_URL (e.g.
 * https://meeting-joiner.demo.futurepath.ai). All endpoints are listed in
 * meeting-joiner/src/main.py — keep this file in lockstep with that.
 */

'use client';

import { meetingJoinerInstance } from 'api/common/axiosInstance';

export type MeetingStatus = 'not_joined' | 'scheduled' | 'ongoing' | 'completed';

export interface MeetingListItem {
  meeting_id: string;
  status: MeetingStatus;
  meeting_url: string;
  platform: string | null;
  bot_name: string | null;
  org_id: string | null;
  created_at: string;
  bot_join_time: string | null;
  bot_leave_time: string | null;
  duration_seconds: number | null;
  participant_count: number;
  transcript_entries: number;
  video_link: string | null;
}

export interface MeetingListResponse {
  meetings: MeetingListItem[];
  next_cursor: string | null;
  total: number | null;
}

export interface MeetingStatusResponse {
  meeting_id: string;
  status: MeetingStatus;
  meeting_url: string;
  platform: string | null;
  created_at: string;
  bot_join_time: string | null;
  bot_leave_time: string | null;
  participant_count: number;
  transcript_entries: number;
  video_link: string | null;
  org_id: string | null;
  is_duplicate: boolean;
  original_meeting_id: string | null;
}

export interface TranscriptEntry {
  timestamp: string;
  speaker: string;
  content: string;
  confidence: number | null;
}

export interface FormattedTranscript {
  entries: TranscriptEntry[];
  summary: string | null;
  key_points: string[] | null;
  action_items: string[] | null;
}

export interface ParticipantInfo {
  id: string;
  name: string;
  email: string | null;
  joined_at: string;
  left_at: string | null;
  is_present: boolean;
}

export interface MeetingTranscriptResponse {
  meeting_id: string;
  status: MeetingStatus;
  transcript: FormattedTranscript;
  participants: ParticipantInfo[] | null;
  last_updated: string;
  last_segment_at: string | null;
  total_duration: number | null;
}

/**
 * Per-meeting transcript source. Selected once at creation time via
 * the dashboard toggle (NewMeetingDialog) — the bot worker reads this
 * field off the meeting_joiner row and forwards it to the platform
 * bot.
 *
 *  audio_asr      → per-peer audio capture → AWS / Azure streaming.
 *                   Best accuracy, costs roughly $1.44/h per active
 *                   speaker on AWS Transcribe Streaming.
 *  gmeet_captions → scrape Google Meet's built-in live captions.
 *                   Free; ~82% accuracy; Meet only.
 *  teams_captions → use Teams platform captions. Teams only.
 *
 * Omit / leave undefined to inherit the bot's platform default.
 */
export type TranscriptSource = 'audio_asr' | 'gmeet_captions' | 'teams_captions';

export interface CreateMeetingRequest {
  meeting_url: string;
  org_id?: string;
  bot_name?: string;
  transcript_source?: TranscriptSource;
  /** ISO 8601 UTC timestamp. When set, the bot is dispatched at this time
   *  instead of immediately. Must be in the future. */
  scheduled_at?: string;
}

export interface CreateMeetingResponse {
  meeting_id: string;
  status: MeetingStatus;
  queued_at: string;
  message: string;
  is_duplicate: boolean;
  original_meeting_id: string | null;
  scheduled_at: string | null;
}

export interface ListMeetingsParams {
  org_id?: string;
  status?: MeetingStatus | MeetingStatus[];
  since?: string; // ISO 8601
  until?: string;
  limit?: number;
  offset?: number;
}

const serializeStatus = (s?: MeetingStatus | MeetingStatus[]): string | undefined => {
  if (!s) return undefined;
  return Array.isArray(s) ? s.join(',') : s;
};

export const MeetingJoiner = {
  async list(params: ListMeetingsParams = {}): Promise<MeetingListResponse> {
    const res = await meetingJoinerInstance.get<MeetingListResponse>('/meetings/list', {
      params: {
        org_id: params.org_id,
        status: serializeStatus(params.status),
        since: params.since,
        until: params.until,
        limit: params.limit ?? 50,
        offset: params.offset ?? 0,
      },
    });
    return res.data;
  },

  async getStatus(meetingId: string): Promise<MeetingStatusResponse> {
    const res = await meetingJoinerInstance.get<MeetingStatusResponse>('/meetings', {
      params: { meeting_id: meetingId },
    });
    return res.data;
  },

  async getTranscript(
    meetingId: string,
    opts: { since?: string; format?: 'detailed' | 'simple' | 'raw' | 'text_only' } = {},
  ): Promise<MeetingTranscriptResponse> {
    const res = await meetingJoinerInstance.get<MeetingTranscriptResponse>(
      '/meetings/transcripts',
      {
        params: {
          meeting_id: meetingId,
          since: opts.since,
          format: opts.format ?? 'detailed',
          include_speakers: true,
        },
      },
    );
    return res.data;
  },

  async create(payload: CreateMeetingRequest): Promise<CreateMeetingResponse> {
    const res = await meetingJoinerInstance.post<CreateMeetingResponse>('/meetings', payload);
    return res.data;
  },

  async stop(meetingId: string): Promise<{ message: string; meeting_id: string; status: MeetingStatus }> {
    const res = await meetingJoinerInstance.delete(`/meetings/${meetingId}`);
    return res.data;
  },
};

export const meetingDuration = (m: { bot_join_time: string | null; bot_leave_time: string | null }): number | null => {
  if (!m.bot_join_time) return null;
  const start = new Date(m.bot_join_time).getTime();
  const end = m.bot_leave_time ? new Date(m.bot_leave_time).getTime() : Date.now();
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return Math.max(0, Math.floor((end - start) / 1000));
};

export const formatDuration = (seconds: number | null): string => {
  if (seconds === null || seconds < 0) return '–';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

export const speakerColorClass = (speaker: string): string => {
  const palette = [
    'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
    'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
    'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200',
    'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200',
    'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-200',
    'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200',
    'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200',
  ];
  let h = 0;
  for (let i = 0; i < speaker.length; i += 1) {
    h = (h * 31 + speaker.charCodeAt(i)) >>> 0;
  }
  return palette[h % palette.length];
};
