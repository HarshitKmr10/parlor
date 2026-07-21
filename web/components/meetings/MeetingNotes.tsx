"use client";

import { useState } from "react";
import { putJson } from "@/lib/api/browser";
import type { MeetingNote } from "@/lib/api/types";

type Props = {
  meetingId: string;
  initialNote: MeetingNote;
};

export function MeetingNotes({ meetingId, initialNote }: Props) {
  const [body, setBody] = useState(initialNote.body);
  const [savedBody, setSavedBody] = useState(initialNote.body);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const isDirty = body !== savedBody;

  const save = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setError(undefined);
    setShowSaved(false);
    try {
      const saved = await putJson<MeetingNote>(
        `/api/meeting-notes/${meetingId}`,
        { body },
      );
      setSavedBody(saved.body);
      setBody(saved.body);
      setShowSaved(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't save your note.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <textarea
        aria-label="Your private notes"
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
          setShowSaved(false);
        }}
        rows={4}
        placeholder="Only you can see these notes."
        className="w-full resize-y rounded-lg border border-border-default bg-surface-0 px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-border-strong focus:outline-none"
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={isSaving || !isDirty}
          className="inline-flex items-center rounded-full border border-border-strong bg-surface-2 px-3 py-1 text-sm text-ink transition-colors hover:bg-surface-3 disabled:opacity-60"
        >
          {isSaving ? "Saving…" : "Save"}
        </button>
        {showSaved && !isDirty && (
          <span role="status" className="text-sm text-ink-muted">
            Saved
          </span>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}
    </div>
  );
}
