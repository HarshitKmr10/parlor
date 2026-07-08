"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { postJson } from "@/lib/api/browser";
import type { Meeting } from "@/lib/api/types";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

type Mode = "now" | "schedule";

function isValidMeetingUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function NewMeetingModal({ isOpen, onClose }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("now");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [title, setTitle] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [urlError, setUrlError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reset = () => {
    setMeetingUrl("");
    setTitle("");
    setScheduledAt("");
    setUrlError(undefined);
    setFormError(undefined);
    setMode("now");
  };

  const handleClose = () => {
    if (isSubmitting) return;
    reset();
    onClose();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(undefined);

    if (!isValidMeetingUrl(meetingUrl.trim())) {
      setUrlError("Enter a valid meeting link (Zoom, Meet, or Teams).");
      return;
    }
    setUrlError(undefined);

    setIsSubmitting(true);
    try {
      const meeting = await postJson<Meeting>("/api/meetings", {
        meetingUrl: meetingUrl.trim(),
        title: title.trim() || undefined,
        scheduledAt:
          mode === "schedule" && scheduledAt
            ? new Date(scheduledAt).toISOString()
            : undefined,
      });
      reset();
      onClose();
      router.push(`/meetings/${meeting.id}`);
      router.refresh();
    } catch (error: unknown) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Couldn't create the meeting. Try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="New meeting"
      description="Drop in a meeting link and Parlor's bot will join, transcribe, and summarize."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div
          role="tablist"
          aria-label="Meeting timing"
          className="inline-flex rounded-md border border-border-subtle bg-surface-1 p-0.5"
        >
          {(["now", "schedule"] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={mode === option}
              onClick={() => setMode(option)}
              className={`flex-1 rounded-[5px] px-3 py-1.5 text-sm font-medium transition-colors ${
                mode === option
                  ? "bg-surface-0 text-ink shadow-soft-sm"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              {option === "now" ? "Join now" : "Schedule"}
            </button>
          ))}
        </div>

        <TextField
          label="Meeting link"
          type="url"
          inputMode="url"
          autoComplete="off"
          placeholder="https://zoom.us/j/123456789"
          value={meetingUrl}
          onChange={(event) => setMeetingUrl(event.target.value)}
          error={urlError}
          hint="Parlor's bot records this call. Recording-consent laws vary by location — make sure you're allowed to record before it joins."
          required
        />

        <TextField
          label="Title (optional)"
          placeholder="Q3 Product Kickoff"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />

        {mode === "schedule" && (
          <TextField
            label="Starts at"
            type="datetime-local"
            value={scheduledAt}
            onChange={(event) => setScheduledAt(event.target.value)}
            hint="Parlor joins automatically at this time."
          />
        )}

        {formError && (
          <p
            role="alert"
            className="rounded-md bg-error-bg px-3 py-2 text-sm text-error"
          >
            {formError}
          </p>
        )}

        <div className="mt-1 flex justify-end gap-2">
          <Button variant="ghost" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? "Creating…"
              : mode === "now"
                ? "Join & transcribe"
                : "Schedule meeting"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
