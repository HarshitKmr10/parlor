"use client";

import { useState } from "react";
import { getJson, postJson, del } from "@/lib/api/browser";
import type { ShareLink } from "@/lib/api/types";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Toggle } from "@/components/ui/Toggle";

type Props = {
  meetingId: string;
};

function absoluteUrl(share: ShareLink): string {
  if (share.url) return share.url;
  if (typeof window !== "undefined") return `${window.location.origin}${share.path}`;
  return share.path;
}

export function ShareButton({ meetingId }: Props) {
  const [open, setOpen] = useState(false);
  const [share, setShare] = useState<ShareLink | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [includeTranscript, setIncludeTranscript] = useState(false);
  const [includeAnalytics, setIncludeAnalytics] = useState(true);

  const openModal = async () => {
    setOpen(true);
    setError(null);
    setLoading(true);
    try {
      const existing = await getJson<ShareLink>(`/api/meetings/${meetingId}/share`);
      if (!existing.revoked) {
        setShare(existing);
        setIncludeTranscript(existing.includeTranscript);
        setIncludeAnalytics(existing.includeAnalytics);
      }
    } catch {
      // No active share yet — that's fine.
    } finally {
      setLoading(false);
    }
  };

  const create = async () => {
    setLoading(true);
    setError(null);
    try {
      const created = await postJson<ShareLink>(`/api/meetings/${meetingId}/share`, {
        includeTranscript,
        includeAnalytics,
        includeHighlights: true,
      });
      setShare(created);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create share link.");
    } finally {
      setLoading(false);
    }
  };

  const revoke = async () => {
    setLoading(true);
    try {
      await del(`/api/meetings/${meetingId}/share`);
      setShare(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to revoke link.");
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!share) return;
    try {
      await navigator.clipboard.writeText(absoluteUrl(share));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Copy failed — select the link manually.");
    }
  };

  return (
    <>
      <Button variant="secondary" size="sm" onClick={openModal}>
        Share
      </Button>
      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Share this recap"
        description="Anyone with the link can view the recap — no account needed."
      >
        <div className="flex flex-col gap-4">
          {error && <p className="text-sm text-error">{error}</p>}

          {share ? (
            <>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={absoluteUrl(share)}
                  data-testid="share-url"
                  className="flex-1 truncate rounded-md border border-border-default bg-surface-1 px-3 py-2 font-mono text-xs text-ink"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <Button size="sm" onClick={copy}>
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <p className="text-xs text-ink-muted">
                {share.viewCount} view{share.viewCount === 1 ? "" : "s"} so far.
              </p>
              <button
                type="button"
                onClick={revoke}
                disabled={loading}
                className="self-start text-sm text-error hover:underline disabled:opacity-50"
              >
                Revoke link
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-ink-soft">Include full transcript</span>
                <Toggle
                  checked={includeTranscript}
                  onChange={setIncludeTranscript}
                  label="Include full transcript"
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-ink-soft">Include analytics</span>
                <Toggle
                  checked={includeAnalytics}
                  onChange={setIncludeAnalytics}
                  label="Include analytics"
                />
              </div>
              <Button onClick={create} disabled={loading}>
                {loading ? "Creating…" : "Create share link"}
              </Button>
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
