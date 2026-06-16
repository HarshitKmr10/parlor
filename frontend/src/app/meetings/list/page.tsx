'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeftIcon, MagnifyingGlassIcon, PlusIcon, ReloadIcon, ExternalLinkIcon, ExitIcon, UpdateIcon, StopIcon } from '@radix-ui/react-icons';
import { API } from 'api';
import {
  MeetingListItem,
  MeetingStatus,
  formatDuration,
  meetingDuration,
} from 'api/meetingJoiner';
import { StatusBadge } from '../components/StatusBadge';
import { NewMeetingDialog } from '../components/NewMeetingDialog';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ThemeToggle } from '../components/ThemeToggle';

const REFRESH_INTERVAL_MS = 5_000;
const PAGE_SIZE = 50;
const STATUS_FILTERS: { value: MeetingStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'ongoing', label: 'Live' },
  { value: 'not_joined', label: 'Queued' },
  { value: 'completed', label: 'Completed' },
];

const formatDateTime = (iso: string | null): string => {
  if (!iso) return '–';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '–';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const platformLabel = (m: MeetingListItem): string => {
  if (m.platform) return m.platform;
  if (/teams\.microsoft\.com/i.test(m.meeting_url)) return 'msteams';
  if (/zoom\.us/i.test(m.meeting_url)) return 'zoom';
  if (/meet\.google\.com/i.test(m.meeting_url)) return 'gmeet';
  return '–';
};

function MeetingsDashboard() {
  const [meetings, setMeetings] = useState<MeetingListItem[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<MeetingStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<MeetingListItem | null>(null);

  const tableTopRef = useRef<HTMLDivElement>(null);

  const load = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      setError(null);
      try {
        const data = await API.MeetingJoiner.list({
          status: statusFilter === 'all' ? undefined : statusFilter,
          limit: PAGE_SIZE,
          offset,
        });
        setMeetings(data.meetings);
        setTotal(data.total ?? data.meetings.length);
      } catch (err: any) {
        const msg = err?.response?.data?.detail ?? err?.message ?? 'Failed to load meetings';
        setError(typeof msg === 'string' ? msg : 'Failed to load meetings');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [statusFilter, offset],
  );

  useEffect(() => {
    load();
  }, [load]);

  // Auto-refresh whenever any row is ongoing OR when "Live" filter is selected.
  const hasLiveRows = useMemo(() => meetings.some((m) => m.status === 'ongoing'), [meetings]);
  useEffect(() => {
    if (!hasLiveRows && statusFilter !== 'ongoing') return undefined;
    const id = setInterval(() => load({ silent: true }), REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [hasLiveRows, statusFilter, load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return meetings;
    return meetings.filter((m) => {
      return (
        m.meeting_url.toLowerCase().includes(q) ||
        (m.bot_name ?? '').toLowerCase().includes(q) ||
        m.meeting_id.toLowerCase().includes(q)
      );
    });
  }, [meetings, search]);

  const handleCreated = useCallback(() => {
    setOffset(0);
    setStatusFilter('all');
    load();
  }, [load]);

  const router = useRouter();
  const handleLogout = useCallback(async () => {
    await fetch('/api/meetings/auth', { method: 'DELETE' });
    router.replace('/meetings/login');
  }, [router]);

  const handleCancelConfirmed = useCallback(async (meeting: MeetingListItem) => {
    setBusyAction(`cancel:${meeting.meeting_id}`);
    try {
      await API.MeetingJoiner.stop(meeting.meeting_id);
      await load({ silent: true });
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? err?.message ?? 'Failed to cancel meeting');
    } finally {
      setBusyAction(null);
      setConfirmCancel(null);
    }
  }, [load]);

  const handleRedispatch = useCallback(async (meeting: MeetingListItem) => {
    setBusyAction(`redispatch:${meeting.meeting_id}`);
    try {
      await API.MeetingJoiner.create({
        meeting_url: meeting.meeting_url,
        bot_name: meeting.bot_name ?? undefined,
        org_id: meeting.org_id ?? undefined,
      });
      await load({ silent: true });
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? err?.message ?? 'Failed to re-dispatch meeting');
    } finally {
      setBusyAction(null);
    }
  }, [load]);

  const totalPages = total ? Math.ceil(total / PAGE_SIZE) : 1;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  // Smooth-scroll the table back into view whenever the page changes —
  // avoids the jarring "I'm halfway down the page on page 2" feel.
  const goToPage = useCallback((nextOffset: number) => {
    setOffset(Math.max(0, nextOffset));
    requestAnimationFrame(() => {
      tableTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  // Build a small page-number window so users can jump arbitrarily without
  // hammering Next 12 times. Window size 5 with current page centered.
  const pageNumbers = useMemo(() => {
    if (totalPages <= 1) return [] as number[];
    const window = 5;
    let start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, start + window - 1);
    if (end - start + 1 < window) start = Math.max(1, end - window + 1);
    const out: number[] = [];
    for (let p = start; p <= end; p += 1) out.push(p);
    return out;
  }, [currentPage, totalPages]);

  return (
    <div className="min-h-screen bg-slate-50 p-6 transition-colors lg:p-8 dark:bg-slate-950">
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-3 flex items-center gap-2 text-sm">
          <Link
            href="/meetings"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-slate-600 transition-colors hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <ArrowLeftIcon /> Back to overview
          </Link>
        </div>

        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">All meetings</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Full historical view. Filter, search, and drill into any meeting our bot has joined.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              title="Sign out"
            >
              <ExitIcon /> Sign out
            </button>
            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              <PlusIcon />
              New meeting
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
          <div className="relative flex-1 min-w-[260px]">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Search meeting URL, bot name, or ID"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-slate-200 bg-white py-1.5 pl-9 pr-3 text-sm text-slate-900 transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>
          <div className="flex items-center gap-1 rounded-md bg-slate-100 p-1 dark:bg-slate-800">
            {STATUS_FILTERS.map((f) => (
              <button
                type="button"
                key={f.value}
                onClick={() => {
                  setStatusFilter(f.value);
                  goToPage(0);
                }}
                className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                  statusFilter === f.value
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => load()}
            disabled={loading || refreshing}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            title="Refresh"
          >
            <ReloadIcon className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Body */}
        {Boolean(error) && (
          <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">
            {error}
          </div>
        )}

        <div ref={tableTopRef} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
          {loading ? (
            <div className="p-12 text-center text-sm text-slate-500 dark:text-slate-400">Loading meetings…</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {search ? 'No meetings match your search.' : 'No meetings yet. Dispatch one to get started.'}
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Bot</th>
                  <th className="px-4 py-3 font-medium">Platform</th>
                  <th className="px-4 py-3 font-medium">Meeting</th>
                  <th className="px-4 py-3 font-medium">Started</th>
                  <th className="px-4 py-3 font-medium">Duration</th>
                  <th className="px-4 py-3 font-medium text-right">Participants</th>
                  <th className="px-4 py-3 font-medium text-right">Segments</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => {
                  const liveDuration = m.status === 'ongoing' ? meetingDuration(m) : m.duration_seconds;
                  return (
                    <tr key={m.meeting_id} className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3">
                        <StatusBadge status={m.status} />
                      </td>
                      <td className="px-4 py-3 text-slate-900 dark:text-slate-100">{m.bot_name ?? '–'}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{platformLabel(m)}</td>
                      <td className="max-w-[380px] truncate px-4 py-3">
                        <a
                          href={m.meeting_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-slate-700 transition-colors hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="truncate">{m.meeting_url}</span>
                          <ExternalLinkIcon className="shrink-0 text-slate-400" />
                        </a>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{formatDateTime(m.bot_join_time ?? m.created_at)}</td>
                      <td className="px-4 py-3 font-mono text-slate-700 dark:text-slate-300">{formatDuration(liveDuration)}</td>
                      <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{m.participant_count}</td>
                      <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{m.transcript_entries}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          {m.status !== 'completed' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmCancel(m);
                              }}
                              disabled={busyAction === `cancel:${m.meeting_id}`}
                              className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-white px-2 py-1 text-xs font-medium text-rose-700 transition-colors hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-950"
                              title={m.status === 'ongoing' ? 'Stop bot' : 'Cancel queued meeting'}
                            >
                              <StopIcon />
                            </button>
                          )}
                          {m.status !== 'ongoing' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRedispatch(m);
                              }}
                              disabled={busyAction === `redispatch:${m.meeting_id}`}
                              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-700"
                              title="Re-dispatch a fresh bot for the same URL"
                            >
                              <UpdateIcon className={busyAction === `redispatch:${m.meeting_id}` ? 'animate-spin' : ''} />
                            </button>
                          )}
                          <Link
                            href={`/meetings/${m.meeting_id}`}
                            className="rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700"
                          >
                            View
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {total !== null && total > PAGE_SIZE && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>
              Showing {offset + 1}–{Math.min(offset + meetings.length, total)} of {total}
            </span>
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => goToPage(0)}
                disabled={offset === 0}
                className="rounded-md border border-slate-200 px-2 py-1 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
                title="First page"
              >
                «
              </button>
              <button
                type="button"
                onClick={() => goToPage(offset - PAGE_SIZE)}
                disabled={offset === 0}
                className="rounded-md border border-slate-200 px-3 py-1 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                Prev
              </button>
              {pageNumbers.map((p) => (
                <button
                  type="button"
                  key={p}
                  onClick={() => goToPage((p - 1) * PAGE_SIZE)}
                  disabled={p === currentPage}
                  className={`min-w-[2rem] rounded-md border px-2 py-1 transition-colors ${
                    p === currentPage
                      ? 'border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-500'
                      : 'border-slate-200 hover:bg-white dark:border-slate-700 dark:hover:bg-slate-800'
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                type="button"
                onClick={() => goToPage(offset + PAGE_SIZE)}
                disabled={offset + PAGE_SIZE >= total}
                className="rounded-md border border-slate-200 px-3 py-1 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                Next
              </button>
              <button
                type="button"
                onClick={() => goToPage((totalPages - 1) * PAGE_SIZE)}
                disabled={offset + PAGE_SIZE >= total}
                className="rounded-md border border-slate-200 px-2 py-1 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
                title="Last page"
              >
                »
              </button>
            </div>
          </div>
        )}
      </div>

      <NewMeetingDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreated={handleCreated} />

      <ConfirmDialog
        open={confirmCancel !== null}
        onOpenChange={(next) => { if (!next) setConfirmCancel(null); }}
        title={confirmCancel?.status === 'ongoing' ? 'Stop the meeting bot?' : 'Cancel queued meeting?'}
        description={
          confirmCancel?.status === 'ongoing'
            ? 'The bot will leave the meeting. Transcript captured so far is preserved. This cannot be undone.'
            : 'The meeting will be removed from the queue and marked completed without ever joining.'
        }
        confirmLabel={confirmCancel?.status === 'ongoing' ? 'Stop bot' : 'Cancel meeting'}
        destructive
        onConfirm={async () => { if (confirmCancel) await handleCancelConfirmed(confirmCancel); }}
      />
    </div>
  );
}

export default MeetingsDashboard;
