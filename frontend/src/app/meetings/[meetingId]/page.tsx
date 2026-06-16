'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  ClipboardCopyIcon,
  DownloadIcon,
  ExternalLinkIcon,
  ReloadIcon,
  StopIcon,
  MagnifyingGlassIcon,
} from '@radix-ui/react-icons';
import { API } from 'api';
import {
  MeetingStatusResponse,
  MeetingTranscriptResponse,
  ParticipantInfo,
  TranscriptEntry,
  formatDuration,
  meetingDuration,
} from 'api/meetingJoiner';
import { StatusBadge } from '../components/StatusBadge';
import { TranscriptTimeline } from '../components/TranscriptTimeline';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EventsTimeline } from '../components/EventsTimeline';

const POLL_INTERVAL_MS = 3_000;

const computeSpeakingTime = (
  entries: TranscriptEntry[],
  participantNames: Set<string>,
): Map<string, number> => {
  // Best-effort: each entry counts as ~3s of speech for its named speaker.
  // When the binder hasn't locked, raw spk_N labels are still surfaced so
  // analytics can show "unverified speaker" buckets.
  const totals = new Map<string, number>();
  for (let i = 0; i < entries.length; i += 1) {
    const e = entries[i];
    const next = entries[i + 1];
    let durationSec = 3;
    if (next) {
      const diff = (new Date(next.timestamp).getTime() - new Date(e.timestamp).getTime()) / 1000;
      if (diff > 0 && diff < 30) durationSec = diff;
    }
    const key = e.speaker;
    totals.set(key, (totals.get(key) ?? 0) + durationSec);
  }
  return totals;
};

const buildTranscriptText = (entries: TranscriptEntry[]): string => {
  return entries
    .map((e) => `[${new Date(e.timestamp).toLocaleTimeString()}] ${e.speaker}: ${e.content}`)
    .join('\n');
};

const buildTranscriptMarkdown = (
  status: MeetingStatusResponse | null,
  entries: TranscriptEntry[],
): string => {
  const header = status
    ? `# Meeting Transcript\n\n- **ID**: \`${status.meeting_id}\`\n- **URL**: ${status.meeting_url}\n- **Status**: ${status.status}\n- **Started**: ${status.bot_join_time ?? '–'}\n\n---\n\n`
    : '';
  const body = entries
    .map((e) => `**${e.speaker}** _(${new Date(e.timestamp).toLocaleTimeString()})_  \n${e.content}\n`)
    .join('\n');
  return header + body;
};

const downloadFile = (filename: string, content: string, mime = 'text/plain') => {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

function MeetingDetail() {
  const params = useParams<{ meetingId: string }>();
  const searchParams = useSearchParams();
  const meetingId = params?.meetingId ?? '';

  const [status, setStatus] = useState<MeetingStatusResponse | null>(null);
  const [transcript, setTranscript] = useState<MeetingTranscriptResponse | null>(null);
  const [entries, setEntries] = useState<TranscriptEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmStop, setConfirmStop] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [copyFlash, setCopyFlash] = useState(false);
  const sinceCursorRef = useRef<string | null>(null);

  const initialLoad = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, t] = await Promise.all([
        API.MeetingJoiner.getStatus(meetingId),
        API.MeetingJoiner.getTranscript(meetingId),
      ]);
      setStatus(s);
      setTranscript(t);
      setEntries(t.transcript.entries ?? []);
      sinceCursorRef.current = t.last_segment_at ?? null;
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? err?.message ?? 'Failed to load meeting';
      setError(typeof msg === 'string' ? msg : 'Failed to load meeting');
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  // Light polling tick: re-fetch status + only-newer transcript segments.
  const pollTick = useCallback(async () => {
    try {
      const s = await API.MeetingJoiner.getStatus(meetingId);
      setStatus(s);

      const t = await API.MeetingJoiner.getTranscript(meetingId, {
        since: sinceCursorRef.current ?? undefined,
      });
      const newEntries = t.transcript.entries ?? [];
      if (newEntries.length > 0) {
        setEntries((prev) => [...prev, ...newEntries]);
        sinceCursorRef.current = t.last_segment_at ?? sinceCursorRef.current;
      } else if (t.last_segment_at) {
        sinceCursorRef.current = t.last_segment_at;
      }
      setTranscript((prev) => (prev ? { ...prev, ...t, transcript: { ...t.transcript, entries: [] } } : t));
    } catch {
      // Swallow transient poll errors; next tick retries.
    }
  }, [meetingId]);

  useEffect(() => {
    if (!meetingId) return;
    initialLoad();
  }, [meetingId, initialLoad]);

  useEffect(() => {
    if (!status || status.status !== 'ongoing') return undefined;
    const id = setInterval(pollTick, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [status?.status, pollTick]);

  const participants: ParticipantInfo[] = useMemo(
    () => transcript?.participants ?? [],
    [transcript?.participants],
  );

  const speakingTotals = useMemo(() => {
    const names = new Set(participants.map((p) => p.name));
    return computeSpeakingTime(entries, names);
  }, [entries, participants]);

  const liveDuration = useMemo(() => {
    if (!status) return null;
    if (status.status === 'ongoing') return meetingDuration(status);
    return transcript?.total_duration ?? meetingDuration(status);
  }, [status, transcript]);

  const handleStopBot = useCallback(async () => {
    try {
      await API.MeetingJoiner.stop(meetingId);
      await initialLoad();
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? err?.message ?? 'Failed to stop bot';
      setError(typeof msg === 'string' ? msg : 'Failed to stop bot');
    }
  }, [meetingId, initialLoad]);

  const handleCopyTranscript = useCallback(async () => {
    const text = buildTranscriptText(entries);
    try {
      await navigator.clipboard.writeText(text);
      setCopyFlash(true);
      setTimeout(() => setCopyFlash(false), 1500);
    } catch {
      // ignore — browser may block clipboard outside of secure context
    }
  }, [entries]);

  const handleExportMarkdown = useCallback(() => {
    downloadFile(`meeting-${meetingId}.md`, buildTranscriptMarkdown(status, entries), 'text/markdown');
  }, [meetingId, status, entries]);

  const handleExportJson = useCallback(() => {
    const payload = {
      status,
      participants,
      entries,
    };
    downloadFile(`meeting-${meetingId}.json`, JSON.stringify(payload, null, 2), 'application/json');
  }, [meetingId, status, participants, entries]);

  const highlightTimestamp = searchParams.get('t');

  if (loading) {
    return <div className="p-12 text-center text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">Loading meeting…</div>;
  }
  if (error || !status) {
    return (
      <div className="p-12 text-center">
        <div className="mx-auto max-w-md rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
          {error ?? 'Meeting not found'}
        </div>
        <Link href="/meetings" className="mt-4 inline-block text-sm text-blue-600 dark:text-blue-400 hover:underline">
          ← Back to meetings
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 transition-colors lg:p-8 dark:bg-slate-950">
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-4 flex items-center gap-2 text-sm">
          <Link
            href="/meetings"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-slate-600 dark:text-slate-300 hover:bg-white"
          >
            <ArrowLeftIcon /> Back to meetings
          </Link>
        </div>

        {/* Header card */}
        <div className="mb-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <StatusBadge status={status.status} />
                <span className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">ID: {status.meeting_id}</span>
                {status.is_duplicate && Boolean(status.original_meeting_id) && (
                  <Link
                    href={`/meetings/${status.original_meeting_id}`}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    → linked to {status.original_meeting_id.slice(0, 8)}…
                  </Link>
                )}
              </div>
              <a
                href={status.meeting_url}
                target="_blank"
                rel="noreferrer"
                className="mt-2 flex items-center gap-1 text-base font-medium text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:text-blue-400 break-all"
              >
                <span className="truncate">{status.meeting_url}</span>
                <ExternalLinkIcon className="shrink-0 text-slate-400 dark:text-slate-500" />
              </a>
              <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-600 dark:text-slate-300 sm:grid-cols-4">
                <Stat label="Platform" value={status.platform ?? '–'} />
                <Stat
                  label="Duration"
                  value={formatDuration(liveDuration)}
                  pulse={status.status === 'ongoing'}
                />
                <Stat label="Participants" value={String(status.participant_count)} />
                <Stat label="Segments" value={String(status.transcript_entries)} />
                <Stat
                  label="Bot joined"
                  value={status.bot_join_time ? new Date(status.bot_join_time).toLocaleString() : '–'}
                />
                <Stat
                  label="Bot left"
                  value={status.bot_leave_time ? new Date(status.bot_leave_time).toLocaleString() : '–'}
                />
                <Stat label="Org" value={status.org_id ?? '–'} />
                <Stat label="Created" value={new Date(status.created_at).toLocaleString()} />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {status.status === 'ongoing' && (
                <button
                  type="button"
                  onClick={() => setConfirmStop(true)}
                  className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900"
                >
                  <StopIcon /> Stop bot
                </button>
              )}
              <button
                type="button"
                onClick={() => initialLoad()}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <ReloadIcon /> Reload
              </button>
            </div>
          </div>

          {Boolean(status.video_link) && (
            <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400 dark:text-slate-500">Recording</p>
              <video src={status.video_link} controls className="w-full rounded-md bg-black" />
            </div>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          {/* Transcript */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white shadow-sm dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 p-4">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Transcript
                {status.status === 'ongoing' && (
                  <span className="ml-2 inline-flex items-center gap-1 text-xs font-normal text-emerald-600 dark:text-emerald-400">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                    Live
                  </span>
                )}
              </h2>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <MagnifyingGlassIcon className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                  <input
                    type="search"
                    placeholder="Search transcript"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-56 rounded-md border border-slate-200 bg-white py-1 pl-8 pr-3 text-xs text-slate-900 transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
                  />
                </div>
                <label className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">
                  <input
                    type="checkbox"
                    checked={autoScroll}
                    onChange={(e) => setAutoScroll(e.target.checked)}
                    className="rounded border-slate-300 dark:border-slate-600"
                  />
                  Auto-scroll
                </label>
                <button
                  type="button"
                  onClick={handleCopyTranscript}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                  title="Copy as text"
                >
                  <ClipboardCopyIcon /> {copyFlash ? 'Copied' : 'Copy'}
                </button>
                <button
                  type="button"
                  onClick={handleExportMarkdown}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                  title="Download .md"
                >
                  <DownloadIcon /> .md
                </button>
                <button
                  type="button"
                  onClick={handleExportJson}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                  title="Download .json"
                >
                  <DownloadIcon /> .json
                </button>
              </div>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-3">
              <TranscriptTimeline
                entries={entries}
                meetingStartTime={status.bot_join_time}
                searchQuery={searchQuery}
                highlightTimestamp={highlightTimestamp}
                autoScroll={autoScroll}
              />
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-4">
          <EventsTimeline
            status={status}
            firstSegmentTimestamp={entries.length > 0 ? entries[0].timestamp : null}
          />
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white shadow-sm dark:bg-slate-900">
            <div className="border-b border-slate-100 dark:border-slate-800 p-4">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Participants</h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">
                Speaking-time is approximate; based on segment cadence.
              </p>
            </div>
            {participants.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">
                No participants seen yet.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {participants.map((p) => {
                  const matchingTotal = speakingTotals.get(p.name) ?? 0;
                  return (
                    <li key={p.id} className="flex items-start justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{p.name}</p>
                        {Boolean(p.email) && <p className="truncate text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">{p.email}</p>}
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">
                          {p.is_present ? (
                            <span className="text-emerald-600 dark:text-emerald-400">● Present</span>
                          ) : (
                            <span>Left {p.left_at ? new Date(p.left_at).toLocaleTimeString() : ''}</span>
                          )}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-xs text-slate-700 dark:text-slate-200">{formatDuration(matchingTotal)}</p>
                        <p className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">est. spoken</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Unverified speaker buckets */}
            {(() => {
              const knownNames = new Set(participants.map((p) => p.name));
              const unverified = Array.from(speakingTotals.entries()).filter(
                ([name]) => !knownNames.has(name),
              );
              if (unverified.length === 0) return null;
              return (
                <div className="border-t border-slate-100 dark:border-slate-800 p-4">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400 dark:text-slate-500">
                    Unverified speakers
                  </p>
                  <ul className="space-y-1">
                    {unverified.map(([name, total]) => (
                      <li key={name} className="flex items-center justify-between text-xs">
                        <span className="text-slate-700 dark:text-slate-200">{name}</span>
                        <span className="font-mono text-slate-500 dark:text-slate-400 dark:text-slate-500">{formatDuration(total)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })()}
          </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmStop}
        onOpenChange={setConfirmStop}
        title="Stop the meeting bot?"
        description="The bot will leave the meeting. Transcript captured so far is preserved. This cannot be undone."
        confirmLabel="Stop bot"
        destructive
        onConfirm={handleStopBot}
      />
    </div>
  );
}

const Stat: React.FC<{ label: string; value: string; pulse?: boolean }> = ({ label, value, pulse }) => (
  <div className="min-w-0">
    <p className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</p>
    <p className={`truncate font-medium text-slate-900 dark:text-slate-100 ${pulse ? 'text-emerald-700 dark:text-emerald-300' : ''}`}>{value}</p>
  </div>
);

export default MeetingDetail;
