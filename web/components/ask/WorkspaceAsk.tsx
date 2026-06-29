"use client";

import { useId, useRef, useState } from "react";
import Link from "next/link";
import { postJson } from "@/lib/api/browser";
import { formatDuration } from "@/lib/format";
import { AskIcon } from "@/components/ui/icons";
import type { AskResponse, ChatTurn, Citation } from "@/lib/api/types";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
};

const SUGGESTIONS = [
  "What did we decide about pricing across all calls?",
  "What are the open action items this week?",
  "Summarize what customers asked for recently.",
];

export function WorkspaceAsk() {
  const inputId = useId();
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const counterRef = useRef(0);

  const nextId = (): string => {
    counterRef.current += 1;
    return `m_${counterRef.current}`;
  };

  const ask = async (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed || isAsking) return;
    setError(undefined);
    const history: ChatTurn[] = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { id: nextId(), role: "user", content: trimmed }]);
    setQuestion("");
    setIsAsking(true);
    try {
      const result = await postJson<AskResponse>("/api/ask", { question: trimmed, history });
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: "assistant", content: result.answer, citations: result.citations },
      ]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't answer that just now. Try again.");
    } finally {
      setIsAsking(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void ask(question);
  };

  return (
    <div className="flex flex-col gap-5">
      {messages.length === 0 ? (
        <div className="rounded-lg border border-border-subtle bg-surface-1 px-6 py-10 text-center">
          <div
            aria-hidden="true"
            className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-sage-50 text-sage-600"
          >
            <AskIcon className="h-6 w-6" />
          </div>
          <h2 className="font-display text-lg text-ink">Ask across every meeting</h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-ink-muted">
            One question, answered from your whole workspace — with citations that
            link back to the exact meeting and moment.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void ask(s)}
                className="rounded-full border border-border-default bg-surface-0 px-3.5 py-1.5 text-sm text-ink-soft transition-colors hover:border-border-strong hover:text-ink"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <ol aria-live="polite" className="flex flex-col gap-4">
          {messages.map((message) =>
            message.role === "user" ? (
              <li key={message.id} className="flex justify-end">
                <p className="max-w-[85%] rounded-lg rounded-br-sm bg-sage-600 px-4 py-2.5 text-sm leading-relaxed text-surface-cream">
                  {message.content}
                </p>
              </li>
            ) : (
              <li key={message.id}>
                <article className="rounded-lg border border-border-subtle bg-surface-0 p-4 shadow-soft-sm">
                  <p className="text-base leading-relaxed text-ink">{message.content}</p>
                  {message.citations && message.citations.length > 0 && (
                    <ul className="mt-3 flex flex-col gap-2">
                      {message.citations.map((c, index) => (
                        <li
                          key={`${c.segmentId}_${index}`}
                          className="rounded-sm bg-gold-50 py-2 pr-3 pl-3"
                          style={{ borderLeft: "3px solid var(--color-gold-400)" }}
                        >
                          <div className="flex flex-wrap items-baseline gap-2">
                            <time className="font-mono text-xs text-gold-700 tabular-nums">
                              {formatDuration(c.tStartSec)}
                            </time>
                            <span className="font-display text-xs font-semibold text-ink-soft uppercase">
                              {c.speakerName}
                            </span>
                            {c.meetingId && c.meetingTitle && (
                              <Link
                                href={`/meetings/${c.meetingId}`}
                                className="text-xs text-sage-700 underline-offset-2 hover:underline"
                              >
                                {c.meetingTitle}
                              </Link>
                            )}
                          </div>
                          <p className="mt-0.5 text-sm leading-relaxed text-ink-soft italic">
                            &ldquo;{c.text}&rdquo;
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              </li>
            ),
          )}
          {isAsking && (
            <li>
              <div className="inline-flex items-center gap-2 rounded-lg border border-border-subtle bg-surface-0 px-4 py-2.5 text-sm text-ink-muted shadow-soft-sm">
                <span className="flex gap-1" aria-hidden="true">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sage-400" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sage-400 [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sage-400 [animation-delay:300ms]" />
                </span>
                Searching across your meetings…
              </div>
            </li>
          )}
        </ol>
      )}

      {error && (
        <p role="alert" className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="sr-only">
          Ask across every meeting
        </label>
        <div className="flex items-center gap-2 rounded-lg border border-border-default bg-surface-0 px-3 py-2 shadow-soft-md focus-within:border-border-strong">
          <AskIcon className="h-5 w-5 shrink-0 text-ink-faint" />
          <input
            id={inputId}
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask across every meeting…"
            autoComplete="off"
            disabled={isAsking}
            className="min-w-0 flex-1 bg-transparent font-sans text-base text-ink outline-none placeholder:text-ink-faint"
          />
          <button
            type="submit"
            disabled={isAsking || question.trim().length === 0}
            className="shrink-0 rounded-md bg-sage-600 px-3.5 py-1.5 font-sans text-sm font-medium text-surface-cream transition-colors hover:bg-sage-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isAsking ? "Asking…" : "Ask"}
          </button>
        </div>
      </form>
    </div>
  );
}
