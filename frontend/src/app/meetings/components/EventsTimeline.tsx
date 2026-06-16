'use client';

import React from 'react';
import { CheckCircledIcon, DotFilledIcon } from '@radix-ui/react-icons';
import { MeetingStatusResponse, TranscriptEntry } from 'api/meetingJoiner';

interface EventsTimelineProps {
  status: MeetingStatusResponse;
  firstSegmentTimestamp: string | null;
}

interface EventItem {
  key: string;
  label: string;
  description: string;
  timestamp: string | null;
  state: 'done' | 'active' | 'pending';
}

const fmt = (iso: string | null): string => {
  if (!iso) return '–';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString();
};

/**
 * Derives a Recall.ai-style event log from the meeting record.
 *
 * The "Bot admitted" event is approximated using the first transcript segment
 * timestamp — admission is when audio actually starts flowing. A precise
 * `bot_admitted_at` field will be added to the meeting record in a follow-up
 * so we don't approximate.
 */
const buildEvents = (status: MeetingStatusResponse, firstSegmentTimestamp: string | null): EventItem[] => {
  const dispatched: EventItem = {
    key: 'dispatched',
    label: 'Bot dispatched',
    description: 'Meeting queued for the joiner worker.',
    timestamp: status.created_at,
    state: 'done',
  };

  const requested: EventItem = {
    key: 'requested',
    label: 'Bot requested joining',
    description: 'Worker spawned a browser session and clicked "Join".',
    timestamp: status.bot_join_time,
    state: status.bot_join_time ? 'done' : 'pending',
  };

  const admitted: EventItem = {
    key: 'admitted',
    label: 'Bot admitted',
    description: firstSegmentTimestamp
      ? 'Approximated from first audio segment received.'
      : 'Will fire when the bot is let in from the lobby.',
    timestamp: firstSegmentTimestamp,
    state: firstSegmentTimestamp ? 'done' : status.status === 'ongoing' ? 'active' : 'pending',
  };

  const isLive = status.status === 'ongoing';
  const recording: EventItem = {
    key: 'recording',
    label: 'Live recording',
    description: isLive
      ? 'Capturing per-track audio + DOM-based speaker attribution.'
      : status.bot_leave_time
        ? 'Recording window closed.'
        : 'Will start when the bot is admitted.',
    timestamp: firstSegmentTimestamp,
    state: isLive ? 'active' : status.bot_leave_time ? 'done' : 'pending',
  };

  const ended: EventItem = {
    key: 'ended',
    label: 'Call ended',
    description: status.bot_leave_time
      ? 'Bot left and the meeting was finalized.'
      : 'Pending — bot still attached.',
    timestamp: status.bot_leave_time,
    state: status.bot_leave_time ? 'done' : 'pending',
  };

  return [dispatched, requested, admitted, recording, ended];
};

export const EventsTimeline: React.FC<EventsTimelineProps> = ({ status, firstSegmentTimestamp }) => {
  const events = buildEvents(status, firstSegmentTimestamp);
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-slate-100 dark:border-slate-800 p-4">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Bot lifecycle</h2>
      </div>
      <ol className="p-4">
        {events.map((event, idx) => (
          <li key={event.key} className="relative flex gap-3 pb-5 last:pb-0">
            {idx < events.length - 1 && (
              <span
                className={`absolute left-[9px] top-5 h-full w-px ${
                  event.state === 'done' ? 'bg-emerald-300 dark:bg-emerald-700' : 'bg-slate-200 dark:bg-slate-700'
                }`}
              />
            )}
            <span className="relative z-10 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
              {event.state === 'done' && (
                <CheckCircledIcon className="h-5 w-5 text-emerald-500" />
              )}
              {event.state === 'active' && (
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
                </span>
              )}
              {event.state === 'pending' && <DotFilledIcon className="h-5 w-5 text-slate-300 dark:text-slate-600" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p
                  className={`text-sm font-medium ${
                    event.state === 'pending' ? 'text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-slate-100'
                  }`}
                >
                  {event.label}
                </p>
                <span className="font-mono text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">{fmt(event.timestamp)}</span>
              </div>
              <p
                className={`mt-0.5 text-xs ${
                  event.state === 'pending' ? 'text-slate-400 dark:text-slate-500' : 'text-slate-500 dark:text-slate-400 dark:text-slate-500'
                }`}
              >
                {event.description}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
};
