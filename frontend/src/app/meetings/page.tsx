'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ActivityLogIcon,
  ArrowRightIcon,
  ExitIcon,
  ExternalLinkIcon,
  PlusIcon,
  ReloadIcon,
  StopIcon,
  UpdateIcon,
} from '@radix-ui/react-icons';
import { API } from 'api';
import {
  MeetingListItem,
  MeetingStatus,
  formatDuration,
  meetingDuration,
} from 'api/meetingJoiner';
import { StatusBadge } from './components/StatusBadge';
import { NewMeetingDialog } from './components/NewMeetingDialog';
import { ConfirmDialog } from './components/ConfirmDialog';
import { ThemeToggle } from './components/ThemeToggle';

const REFRESH_INTERVAL_MS = 5_000;
const STUCK_QUEUE_THRESHOLD_MS = 60_000; // queued > 60s = consider stuck

const formatRelative = (iso: string): string => {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: '2-digit' });
};

const platformLabel = (m: MeetingListItem): string => {
  if (m.platform) return m.platform;
  if (/teams\.microsoft\.com/i.test(m.meeting_url)) return 'msteams';
  if (/zoom\.us/i.test(m.meeting_url)) return 'zoom';
  if (/meet\.google\.com/i.test(m.meeting_url)) return 'gmeet';
  return '–';
};

interface KpiCardProps {
  label: string;
  value: string | number;
  hint?: string;
  pulse?: boolean;
}

const KpiCard: React.FC<KpiCardProps> = ({ label, value, hint, pulse }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
    <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
    <p className={`mt-2 text-3xl font-semibold tabular-nums ${pulse ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-slate-100'}`}>
      {value}
    </p>
    {Boolean(hint) && <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{hint}</p>}
  </div>
);

function MeetingsOverview() {
  const router = useRouter();
  const [meetings, setMeetings] = useState<MeetingListItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<MeetingListItem | null>(null);

  const load = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      // Pull a recent slice so we have enough data for KPIs + panels
      // without fetching every meeting in history.
      const data = await API.MeetingJoiner.list({ limit: 200, offset: 0 });
      setMeetings(data.meetings);
      setTotal(data.total ?? data.meetings.length);
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? err?.message ?? 'Failed to load meetings';
      setError(typeof msg === 'string' ? msg : 'Failed to load meetings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-refresh whenever any row is ongoing — cheap KPI churn for live meetings.
  const hasLiveRows = useMemo(() => meetings.some((m) => m.status === 'ongoing'), [meetings]);
  useEffect(() => {
    if (!hasLiveRows) return undefined;
    const id = setInterval(() => load({ silent: true }), REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [hasLiveRows, load]);

  // KPIs
  const liveMeetings = useMemo(() => meetings.filter((m) => m.status === 'ongoing'), [meetings]);
  const queuedMeetings = useMemo(() => meetings.filter((m) => m.status === 'not_joined'), [meetings]);
  const stuckMeetings = useMemo(
    () => queuedMeetings.filter((m) => Date.now() - new Date(m.created_at).getTime() > STUCK_QUEUE_THRESHOLD_MS),
    [queuedMeetings],
  );
  const last24hCount = useMemo(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return meetings.filter((m) => new Date(m.created_at).getTime() >= cutoff).length;
  }, [meetings]);

  const orgBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of meetings) {
      const key = m.org_id ?? '(no org)';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [meetings]);

  const recent = useMemo(() => meetings.slice(0, 8), [meetings]);

  const handleLogout = useCallback(async () => {
    await fetch('/api/meetings/auth', { method: 'DELETE' });
    router.replace('/meetings/login');
  }, [router]);

  const handleCancel = useCallback(async (meeting: MeetingListItem) => {
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

  const totalMeetingsLabel = total ? total.toLocaleString() : meetings.length.toLocaleString();
  const orgCount = useMemo(() => new Set(meetings.map((m) => m.org_id ?? '(no org)')).size, [meetings]);

  return (
    <div className="min-h-screen bg-slate-50 p-6 transition-colors lg:p-8 dark:bg-slate-950">
      <div className="mx-auto max-w-[1400px] space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                Meeting Joiner
              </h1>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                Internal
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Operations dashboard for the meeting bot. Track live calls, audit transcripts, and unstick queued jobs.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => load()}
              disabled={loading || refreshing}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              title="Refresh"
              aria-label="Refresh"
            >
              <ReloadIcon className={refreshing ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <ExitIcon /> Sign out
            </button>
            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              <PlusIcon /> New meeting
            </button>
          </div>
        </div>

        {Boolean(error) && (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
            {error}
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            label="Total meetings"
            value={loading ? '–' : totalMeetingsLabel}
            hint={`Across ${orgCount} ${orgCount === 1 ? 'org' : 'orgs'}`}
          />
          <KpiCard
            label="Live now"
            value={loading ? '–' : liveMeetings.length}
            hint={liveMeetings.length > 0 ? 'Bot actively recording' : 'No active calls'}
            pulse={liveMeetings.length > 0}
          />
          <KpiCard
            label="Queued"
            value={loading ? '–' : queuedMeetings.length}
            hint={stuckMeetings.length > 0 ? `${stuckMeetings.length} stuck > 1m` : 'Queue is healthy'}
          />
          <KpiCard
            label="Last 24 h"
            value={loading ? '–' : last24hCount}
            hint="Dispatched in last day"
          />
        </div>

        {/* Live + Stuck side by side on lg */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Live meetings */}
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
            <header className="flex items-center justify-between border-b border-slate-100 px-5 py-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  {liveMeetings.length > 0 && (
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  )}
                  <span className={`relative inline-flex h-2 w-2 rounded-full ${liveMeetings.length > 0 ? 'bg-emerald-500' : 'bg-slate-400 dark:bg-slate-600'}`} />
                </span>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Live meetings</h2>
                <span className="text-xs text-slate-500 dark:text-slate-400">({liveMeetings.length})</span>
              </div>
            </header>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {liveMeetings.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  No active meetings. Dispatch one to get started.
                </div>
              ) : (
                liveMeetings.map((m) => (
                  <div key={m.meeting_id} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                          {m.bot_name ?? 'Unnamed bot'}
                        </p>
                        <span className="text-xs text-slate-400 dark:text-slate-500">·</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{platformLabel(m)}</span>
                        <span className="text-xs text-slate-400 dark:text-slate-500">·</span>
                        <span className="font-mono text-xs text-slate-600 dark:text-slate-300">
                          {formatDuration(meetingDuration(m))}
                        </span>
                      </div>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">{m.meeting_url}</p>
                    </div>
                    <Link
                      href={`/meetings/${m.meeting_id}`}
                      className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      View
                    </Link>
                    <button
                      type="button"
                      onClick={() => setConfirmCancel(m)}
                      disabled={busyAction === `cancel:${m.meeting_id}`}
                      className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300 dark:hover:bg-rose-900"
                    >
                      <StopIcon /> Stop
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Stuck queue */}
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
            <header className="flex items-center justify-between border-b border-slate-100 px-5 py-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <ActivityLogIcon className={stuckMeetings.length > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500'} />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Stuck in queue</h2>
                <span className="text-xs text-slate-500 dark:text-slate-400">({stuckMeetings.length})</span>
              </div>
              {stuckMeetings.length > 0 && (
                <span className="text-xs text-slate-500 dark:text-slate-400">queued &gt; 1 min</span>
              )}
            </header>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {stuckMeetings.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  {queuedMeetings.length === 0
                    ? 'Queue is empty.'
                    : `${queuedMeetings.length} fresh in queue, none stuck.`}
                </div>
              ) : (
                stuckMeetings.map((m) => (
                  <div key={m.meeting_id} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                          {m.bot_name ?? 'Unnamed bot'}
                        </p>
                        <span className="text-xs text-amber-600 dark:text-amber-400">queued {formatRelative(m.created_at)}</span>
                      </div>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">{m.meeting_url}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRedispatch(m)}
                      disabled={busyAction === `redispatch:${m.meeting_id}`}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                      title="Dispatch a fresh bot for the same URL"
                    >
                      <UpdateIcon className={busyAction === `redispatch:${m.meeting_id}` ? 'animate-spin' : ''} /> Re-dispatch
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmCancel(m)}
                      disabled={busyAction === `cancel:${m.meeting_id}`}
                      className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300 dark:hover:bg-rose-900"
                    >
                      Cancel
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Recent activity + Top orgs */}
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          {/* Recent activity */}
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
            <header className="flex items-center justify-between border-b border-slate-100 px-5 py-3 dark:border-slate-800">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Recent activity</h2>
              <Link
                href="/meetings/list"
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                View all meetings <ArrowRightIcon />
              </Link>
            </header>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <div className="px-5 py-8 text-center text-sm text-slate-500 dark:text-slate-400">Loading…</div>
              ) : recent.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  No meetings yet.
                </div>
              ) : (
                recent.map((m) => {
                  const liveDuration = m.status === 'ongoing' ? meetingDuration(m) : m.duration_seconds;
                  return (
                    <Link
                      key={m.meeting_id}
                      href={`/meetings/${m.meeting_id}`}
                      className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <StatusBadge status={m.status} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                          {m.bot_name ?? 'Unnamed bot'}
                        </p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                          {platformLabel(m)} · {formatRelative(m.bot_join_time ?? m.created_at)}
                          {' · '}
                          {m.transcript_entries} {m.transcript_entries === 1 ? 'segment' : 'segments'}
                        </p>
                      </div>
                      <span className="hidden font-mono text-xs text-slate-500 sm:block dark:text-slate-400">
                        {formatDuration(liveDuration)}
                      </span>
                      <ExternalLinkIcon className="text-slate-400 dark:text-slate-500" />
                    </Link>
                  );
                })
              )}
            </div>
          </section>

          {/* Top orgs */}
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
            <header className="border-b border-slate-100 px-5 py-3 dark:border-slate-800">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Top orgs</h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">By meeting count in recent activity</p>
            </header>
            <div className="space-y-3 p-5">
              {loading || orgBreakdown.length === 0 ? (
                <p className="text-center text-sm text-slate-500 dark:text-slate-400">
                  {loading ? 'Loading…' : 'No org data yet.'}
                </p>
              ) : (
                (() => {
                  const max = orgBreakdown[0][1];
                  return orgBreakdown.map(([org, count]) => (
                    <div key={org}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="truncate font-medium text-slate-700 dark:text-slate-200" title={org}>
                          {org === '(no org)' ? <em className="text-slate-400 dark:text-slate-500">No org</em> : org.length > 24 ? `${org.slice(0, 8)}…${org.slice(-8)}` : org}
                        </span>
                        <span className="font-mono text-slate-500 dark:text-slate-400">{count}</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className="h-full rounded-full bg-blue-500 transition-all dark:bg-blue-400"
                          style={{ width: `${Math.max(8, (count / max) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ));
                })()
              )}
            </div>
          </section>
        </div>
      </div>

      <NewMeetingDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreated={() => load()} />

      <ConfirmDialog
        open={confirmCancel !== null}
        onOpenChange={(next) => { if (!next) setConfirmCancel(null); }}
        title={
          confirmCancel?.status === 'ongoing'
            ? 'Stop the meeting bot?'
            : 'Cancel queued meeting?'
        }
        description={
          confirmCancel?.status === 'ongoing'
            ? 'The bot will leave the meeting. Transcript captured so far is preserved. This cannot be undone.'
            : 'The meeting will be removed from the queue and marked completed without ever joining.'
        }
        confirmLabel={confirmCancel?.status === 'ongoing' ? 'Stop bot' : 'Cancel meeting'}
        destructive
        onConfirm={async () => { if (confirmCancel) await handleCancel(confirmCancel); }}
      />
    </div>
  );
}

export default MeetingsOverview;
