"use client";

import { useId, useState } from "react";
import type { AskAnswer, Speaker } from "./types";
import { formatClock, indexSpeakers } from "./utils";
import { mockAsk } from "./mockData";

type Props = {
  speakers: Speaker[];
  /** Resolver for a question. Defaults to the mocked, cited answer. */
  onAsk?: (question: string) => Promise<AskAnswer>;
};

export function AskBar({ speakers, onAsk = mockAsk }: Props) {
  const inputId = useId();
  const [question, setQuestion] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [answer, setAnswer] = useState<AskAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);

  const speakerById = indexSpeakers(speakers);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || isAsking) return;

    setIsAsking(true);
    setError(null);
    try {
      const result = await onAsk(trimmed);
      setAnswer(result);
    } catch {
      setError("Couldn't answer that just now. Try again in a moment.");
    } finally {
      setIsAsking(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {answer && (
        <article
          aria-live="polite"
          className="rounded-lg border border-border-subtle bg-surface-0 p-4 shadow-soft-sm"
        >
          <p className="eyebrow mb-1.5">Answer</p>
          <p className="text-base leading-relaxed text-ink">{answer.answer}</p>

          {answer.citations.length > 0 && (
            <ul className="mt-3 flex flex-col gap-2">
              {answer.citations.map((citation) => {
                const speaker = speakerById.get(citation.speakerId);
                return (
                  <li
                    key={citation.segmentId}
                    className="rounded-sm bg-gold-50 py-2 pr-3 pl-3"
                    style={{ borderLeft: "2px solid var(--border-gold)" }}
                  >
                    <div className="flex items-baseline gap-2">
                      <time className="font-mono text-xs text-gold-700 tabular-nums">
                        {formatClock(citation.tSec)}
                      </time>
                      <span className="font-display text-xs font-semibold text-ink-soft uppercase">
                        {speaker?.name ?? "Unknown"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm leading-relaxed text-ink-soft italic">
                      “{citation.text}”
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </article>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-sm bg-error-bg px-3 py-2 text-sm text-error"
        >
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="sr-only">
          Ask this meeting a question
        </label>
        <div className="flex items-center gap-2 rounded-lg border border-border-default bg-surface-0 px-3 py-2 shadow-soft-sm focus-within:border-border-strong">
          <AskIcon />
          <input
            id={inputId}
            type="text"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask this meeting…"
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

function AskIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-5 w-5 shrink-0 text-ink-faint"
    >
      <path
        d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.6-.8L3 21l1.9-5.4A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
