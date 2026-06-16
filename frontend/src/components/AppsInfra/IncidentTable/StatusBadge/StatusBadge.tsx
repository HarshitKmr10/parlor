import React from 'react';
// eslint-disable-next-line import/no-extraneous-dependencies
import classNames from 'classnames';

type Status = 'pending' | 'in_progress' | 'resolved';

const statusStyles: Record<Status, string> = {
  pending: 'bg-[#FECACA] text-[#C40006]',       // Light red, red text
  in_progress: 'bg-[#FDE68A] text-[#AB6400]',   // Light yellow, dark yellow
  resolved: 'bg-[#6EE7B7] text-[#00713F]',       // Light green, green text
};

const unknownStyle = 'bg-[#0000330F] text-[#0007149F]';

const statusSynonyms: Record<string, Status> = {
  // ── Pending / Waiting states ──
  pending: 'pending',
  waiting: 'pending',
  new: 'pending',
  'to do': 'pending',
  backlog: 'pending',
  queued: 'pending',
  scheduled: 'pending',
  unassigned: 'pending',

  // ── In Progress / Active states ──
  'in progress': 'in_progress',
  in_progress: 'in_progress',
  processing: 'in_progress',
  active: 'in_progress',
  wip: 'in_progress',
  started: 'in_progress',
  working: 'in_progress',
  building: 'in_progress',
  running: 'in_progress',
  executing: 'in_progress',
  doing: 'in_progress',
  investigating: 'in_progress',
  analyzing: 'in_progress',
  triaging: 'in_progress',
  assigning: 'in_progress',
  developing: 'in_progress',
  fixing: 'in_progress',
  compiling: 'in_progress',

  // ── Resolved / Done states ──
  resolved: 'resolved',
  done: 'resolved',
  closed: 'resolved',
  fixed: 'resolved',
  completed: 'resolved',
  success: 'resolved',
  successful: 'resolved',
  released: 'resolved',
  shipped: 'resolved',
  delivered: 'resolved',
  implemented: 'resolved',
  fulfilled: 'resolved',
  verified: 'resolved',
  finished: 'resolved',
  final: 'resolved',
};

export function normalizeStatus(input: string): { normalized: Status; matched: boolean } {
  const key = input?.toLowerCase().trim().replace(/_/g, ' ');
  const match = statusSynonyms[key];
  return {
    normalized: match || 'pending',
    matched: !!match,
  };
}

const StatusBadge = ({ status }: { status: string }) => {
  const { normalized, matched } = normalizeStatus(status);

  return (
    <span
      className={classNames(
        'rounded-md px-2 py-1 text-xs font-medium',
        matched ? statusStyles[normalized] : unknownStyle
      )}
    >
      {status?.replace(/_/g, ' ')}
    </span>
  );
};

export default StatusBadge;