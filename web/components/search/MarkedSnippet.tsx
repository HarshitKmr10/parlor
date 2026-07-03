import { Fragment } from "react";

type Props = {
  /** Snippet from the backend; matches are wrapped in literal <mark>…</mark>. */
  snippet: string;
};

/**
 * Render a search snippet WITHOUT dangerouslySetInnerHTML. The backend wraps
 * matched terms in `<mark>` but does not HTML-escape the surrounding transcript
 * text, which is user-generated and therefore untrusted. We split on the mark
 * tags and render the parts as React text nodes (auto-escaped), so any other
 * markup in the transcript renders as inert literal text.
 */
type MarkState = {
  marking: boolean;
  segments: { text: string; marked: boolean }[];
};

/**
 * Fold the split parts into marked/unmarked text segments without mutating a
 * shared variable across iterations — each step returns a new state object,
 * so the reduction stays a pure function of its inputs.
 */
function foldMarks(state: MarkState, part: string): MarkState {
  if (part === "<mark>") return { ...state, marking: true };
  if (part === "</mark>") return { ...state, marking: false };
  if (part === "") return state;
  return {
    ...state,
    segments: [...state.segments, { text: part, marked: state.marking }],
  };
}

export function MarkedSnippet({ snippet }: Props) {
  const parts = snippet.split(/(<mark>|<\/mark>)/g);
  const { segments } = parts.reduce(foldMarks, {
    marking: false,
    segments: [],
  } as MarkState);

  return (
    <span>
      {segments.map((segment, i) =>
        segment.marked ? (
          <mark key={i} className="rounded bg-gold-200 px-0.5 text-ink">
            {segment.text}
          </mark>
        ) : (
          <Fragment key={i}>{segment.text}</Fragment>
        ),
      )}
    </span>
  );
}
