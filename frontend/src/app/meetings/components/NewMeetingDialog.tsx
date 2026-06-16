'use client';

import React, { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Cross2Icon } from '@radix-ui/react-icons';
import { API } from 'api';
import { CreateMeetingResponse, TranscriptSource } from 'api/meetingJoiner';

interface NewMeetingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (response: CreateMeetingResponse) => void;
}

const TEAMS_RE = /^https:\/\/teams\.microsoft\.com\//i;
const ZOOM_RE = /^https:\/\/[\w.-]*zoom\.us\//i;
const GMEET_RE = /^https:\/\/meet\.google\.com\//i;

// Pick the right captions enum value for the URL we're targeting. The
// backend rejects mismatches (gmeet_captions on a Teams URL, etc.), so
// we resolve from the URL at submit-time rather than asking the user.
const captionsValueForUrl = (url: string): TranscriptSource | null => {
  if (TEAMS_RE.test(url)) return 'teams_captions';
  if (GMEET_RE.test(url)) return 'gmeet_captions';
  return null; // Zoom and others: captions mode unavailable today
};

const validateMeetingUrl = (url: string): string | null => {
  const trimmed = url.trim();
  if (!trimmed) return 'Meeting URL is required';
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') return 'Meeting URL must use HTTPS';
  } catch {
    return 'Not a valid URL';
  }
  if (TEAMS_RE.test(trimmed) || ZOOM_RE.test(trimmed) || GMEET_RE.test(trimmed)) {
    return null;
  }
  return 'Only Teams, Zoom, and Google Meet links are supported';
};

const INPUT_CLASS =
  'mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-400';

type CaptureMode = 'audio' | 'captions';

export const NewMeetingDialog: React.FC<NewMeetingDialogProps> = ({ open, onOpenChange, onCreated }) => {
  const [meetingUrl, setMeetingUrl] = useState('');
  const [botName, setBotName] = useState('');
  const [orgId, setOrgId] = useState('');
  // captureMode is the user-facing axis (audio vs captions). At submit
  // time we resolve it to the platform-specific transcript_source enum
  // ('gmeet_captions' / 'teams_captions') based on the URL.
  const [captureMode, setCaptureMode] = useState<CaptureMode>('audio');
  // Empty = dispatch immediately. When set, the bot joins at this time.
  // `datetime-local` yields a wall-clock string with no offset; we convert
  // it to a UTC ISO string at submit via `new Date(...)`.
  const [scheduledAt, setScheduledAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isScheduled = scheduledAt.trim() !== '';

  const captionsAvailable = captionsValueForUrl(meetingUrl.trim()) !== null;
  // Defensively re-snap the toggle to 'audio' when the URL changes to
  // something that doesn't support captions (e.g. user pasted a Zoom
  // link after picking captions on a Meet link).
  useEffect(() => {
    if (!captionsAvailable && captureMode === 'captions') {
      setCaptureMode('audio');
    }
  }, [captionsAvailable, captureMode]);

  const reset = () => {
    setMeetingUrl('');
    setBotName('');
    setOrgId('');
    setCaptureMode('audio');
    setScheduledAt('');
    setError(null);
    setSubmitting(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmedUrl = meetingUrl.trim();
    const validation = validateMeetingUrl(trimmedUrl);
    if (validation) {
      setError(validation);
      return;
    }
    let transcriptSource: TranscriptSource | undefined;
    if (captureMode === 'captions') {
      const resolved = captionsValueForUrl(trimmedUrl);
      if (!resolved) {
        setError('Captions mode not supported for this meeting platform');
        return;
      }
      transcriptSource = resolved;
    } else {
      transcriptSource = 'audio_asr';
    }
    let scheduledAtIso: string | undefined;
    if (isScheduled) {
      const parsed = new Date(scheduledAt);
      if (Number.isNaN(parsed.getTime())) {
        setError('Schedule time is not a valid date');
        return;
      }
      if (parsed.getTime() <= Date.now()) {
        setError('Schedule time must be in the future');
        return;
      }
      scheduledAtIso = parsed.toISOString();
    }
    setSubmitting(true);
    try {
      const response = await API.MeetingJoiner.create({
        meeting_url: trimmedUrl,
        bot_name: botName.trim() || undefined,
        org_id: orgId.trim() || undefined,
        transcript_source: transcriptSource,
        scheduled_at: scheduledAtIso,
      });
      onCreated(response);
      reset();
      onOpenChange(false);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (detail && typeof detail === 'string') {
        setError(detail);
      } else if (Array.isArray(detail)) {
        setError(detail.map((d: any) => d.msg ?? JSON.stringify(d)).join('; '));
      } else if (err?.message) {
        setError(err.message);
      } else {
        setError('Failed to create meeting');
      }
      setSubmitting(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) reset(); onOpenChange(next); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[480px] max-w-[90vw] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-2xl transition-colors dark:bg-slate-900 dark:ring-1 dark:ring-slate-800">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Dispatch a meeting bot
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                aria-label="Close"
                className="rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                type="button"
              >
                <Cross2Icon />
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Paste a Teams / Zoom / Meet link and the joiner queues a bot. Admit it from the lobby to start transcription.
          </Dialog.Description>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label htmlFor="meeting-url" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                Meeting URL
              </label>
              <input
                id="meeting-url"
                type="url"
                placeholder="https://teams.microsoft.com/..."
                value={meetingUrl}
                onChange={(e) => setMeetingUrl(e.target.value)}
                required
                autoFocus
                className={INPUT_CLASS}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="bot-name" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Bot display name
                </label>
                <input
                  id="bot-name"
                  type="text"
                  placeholder="Meeting Bot"
                  value={botName}
                  onChange={(e) => setBotName(e.target.value)}
                  maxLength={100}
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label htmlFor="org-id" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Org ID <span className="font-normal text-slate-400 dark:text-slate-500">(optional)</span>
                </label>
                <input
                  id="org-id"
                  type="text"
                  placeholder="org-uuid"
                  value={orgId}
                  onChange={(e) => setOrgId(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>
            </div>

            <div>
              <span className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                Transcript source
              </span>
              <div className="mt-1 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Transcript source">
                <button
                  type="button"
                  role="radio"
                  aria-checked={captureMode === 'audio'}
                  onClick={() => setCaptureMode('audio')}
                  className={
                    'rounded-md border px-3 py-2 text-left text-sm transition-colors ' +
                    (captureMode === 'audio'
                      ? 'border-blue-500 bg-blue-50 text-blue-900 ring-1 ring-blue-500 dark:border-blue-400 dark:bg-blue-950 dark:text-blue-100'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700')
                  }
                >
                  <div className="font-medium">Audio (best accuracy)</div>
                  <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Per-peer audio → AWS / Azure streaming. ~$1.44/h per active speaker.
                  </div>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={captureMode === 'captions'}
                  disabled={!captionsAvailable}
                  onClick={() => setCaptureMode('captions')}
                  className={
                    'rounded-md border px-3 py-2 text-left text-sm transition-colors ' +
                    (!captionsAvailable
                      ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-600'
                      : captureMode === 'captions'
                        ? 'border-blue-500 bg-blue-50 text-blue-900 ring-1 ring-blue-500 dark:border-blue-400 dark:bg-blue-950 dark:text-blue-100'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700')
                  }
                >
                  <div className="font-medium">Captions (free)</div>
                  <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {captionsAvailable
                      ? 'Scrape platform captions. Free. Teams + Meet only.'
                      : 'Available only for Teams and Google Meet links.'}
                  </div>
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="scheduled-at" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                Schedule for <span className="font-normal text-slate-400 dark:text-slate-500">(optional)</span>
              </label>
              <input
                id="scheduled-at"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className={INPUT_CLASS}
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {isScheduled
                  ? 'The bot will join automatically at this time.'
                  : 'Leave empty to dispatch the bot immediately.'}
              </p>
            </div>

            {Boolean(error) && (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  disabled={submitting}
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={submitting || !meetingUrl.trim()}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300 dark:bg-blue-500 dark:hover:bg-blue-600 dark:disabled:bg-blue-900"
              >
                {submitting
                  ? isScheduled
                    ? 'Scheduling…'
                    : 'Dispatching…'
                  : isScheduled
                    ? 'Schedule bot'
                    : 'Dispatch bot'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
