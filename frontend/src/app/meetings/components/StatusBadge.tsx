'use client';

import React from 'react';
import { MeetingStatus } from 'api/meetingJoiner';

interface StatusBadgeProps {
  status: MeetingStatus;
}

const STYLES: Record<MeetingStatus, { dot: string; bg: string; text: string; label: string }> = {
  not_joined: {
    dot: 'bg-amber-500',
    bg: 'bg-amber-50 ring-1 ring-inset ring-amber-200 dark:bg-amber-950/40 dark:ring-amber-800/60',
    text: 'text-amber-700 dark:text-amber-300',
    label: 'Queued',
  },
  scheduled: {
    dot: 'bg-indigo-500',
    bg: 'bg-indigo-50 ring-1 ring-inset ring-indigo-200 dark:bg-indigo-950/40 dark:ring-indigo-800/60',
    text: 'text-indigo-700 dark:text-indigo-300',
    label: 'Scheduled',
  },
  ongoing: {
    dot: 'bg-emerald-500 animate-pulse shadow-[0_0_0_3px_rgba(16,185,129,0.2)]',
    bg: 'bg-emerald-50 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-950/40 dark:ring-emerald-800/60',
    text: 'text-emerald-700 dark:text-emerald-300',
    label: 'Live',
  },
  completed: {
    dot: 'bg-blue-500',
    bg: 'bg-blue-50 ring-1 ring-inset ring-blue-200 dark:bg-blue-950/40 dark:ring-blue-800/60',
    text: 'text-blue-700 dark:text-blue-300',
    label: 'Completed',
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const style = STYLES[status] ?? STYLES.completed;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${style.bg} ${style.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {style.label}
    </span>
  );
};
