"use client";

import { useEffect, useState } from "react";
import { getJson, postJson, patchJson, del } from "@/lib/api/browser";
import type { Comment, CommentListResponse } from "@/lib/api/types";
import { Button } from "@/components/ui/Button";
import { formatDuration, formatRelative } from "@/lib/format";

type Props = {
  meetingId: string;
};

export function CommentsTab({ meetingId }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    getJson<CommentListResponse>(`/api/meetings/${meetingId}/comments`, controller.signal)
      .then((res) => setComments(res.items))
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Failed to load comments.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [meetingId]);

  const handlePost = async () => {
    if (!draft.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const created = await postJson<Comment>(`/api/meetings/${meetingId}/comments`, {
        body: draft.trim(),
      });
      setComments((prev) => [...prev, created]);
      setDraft("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to post comment.");
    } finally {
      setSaving(false);
    }
  };

  const toggleResolved = async (comment: Comment) => {
    const next = !comment.resolved;
    setComments((prev) =>
      prev.map((c) => (c.id === comment.id ? { ...c, resolved: next } : c)),
    );
    try {
      await patchJson<Comment>(`/api/meetings/${meetingId}/comments/${comment.id}`, {
        resolved: next,
      });
    } catch {
      setComments((prev) =>
        prev.map((c) => (c.id === comment.id ? { ...c, resolved: !next } : c)),
      );
    }
  };

  const handleDelete = async (id: string) => {
    const snapshot = comments;
    setComments((prev) => prev.filter((c) => c.id !== id));
    try {
      await del(`/api/meetings/${meetingId}/comments/${id}`);
    } catch {
      setComments(snapshot);
      setError("Failed to delete comment.");
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-lg border border-border-subtle bg-surface-1/60 p-4">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a comment for your team…"
          rows={2}
          className="w-full resize-y rounded-md border border-border-default bg-surface-0 px-3 py-2 text-sm text-ink"
        />
        <div className="mt-2 flex justify-end">
          <Button onClick={handlePost} disabled={saving || !draft.trim()} size="sm">
            {saving ? "Posting…" : "Comment"}
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      {loading ? (
        <p className="text-sm text-ink-muted">Loading comments…</p>
      ) : comments.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border-default bg-surface-1/60 px-5 py-10 text-center text-sm text-ink-muted">
          No comments yet. Start the discussion.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {comments.map((c) => (
            <li
              key={c.id}
              className={`group rounded-lg border p-4 shadow-soft-sm ${
                c.resolved
                  ? "border-border-subtle bg-surface-1/50"
                  : "border-border-subtle bg-surface-0"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-sage-100 text-xs font-semibold text-sage-700">
                    {c.author.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="font-sans text-sm font-medium text-ink">{c.author.name}</span>
                  {c.anchorTSec !== undefined && (
                    <span className="font-mono text-xs text-gold-700">
                      @ {formatDuration(c.anchorTSec)}
                    </span>
                  )}
                  {c.resolved && (
                    <span className="rounded-full bg-success-bg px-2 py-0.5 text-xs font-semibold text-success">
                      Resolved
                    </span>
                  )}
                </div>
                <span className="text-xs text-ink-faint">{formatRelative(c.createdAt)}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-ink-soft">{c.body}</p>
              <div className="mt-2 flex gap-3 text-xs opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => toggleResolved(c)}
                  className="text-ink-muted hover:text-sage-700"
                >
                  {c.resolved ? "Reopen" : "Resolve"}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(c.id)}
                  className="text-ink-muted hover:text-error"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
