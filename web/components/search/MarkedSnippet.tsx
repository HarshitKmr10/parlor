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
export function MarkedSnippet({ snippet }: Props) {
  const parts = snippet.split(/(<mark>|<\/mark>)/g);
  let marking = false;
  return (
    <span>
      {parts.map((part, i) => {
        if (part === "<mark>") {
          marking = true;
          return null;
        }
        if (part === "</mark>") {
          marking = false;
          return null;
        }
        if (part === "") return null;
        return marking ? (
          <mark key={i} className="rounded bg-gold-200 px-0.5 text-ink">
            {part}
          </mark>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        );
      })}
    </span>
  );
}
