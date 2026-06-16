import Link from "next/link";

type Props = {
  total: number;
  limit: number;
  offset: number;
  /** Builds the href for a given offset, preserving other filters. */
  buildHref: (offset: number) => string;
};

export function Pagination({ total, limit, offset, buildHref }: Props) {
  const page = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const hasPrev = offset > 0;
  const hasNext = offset + limit < total;

  if (totalPages <= 1) return null;

  const prevOffset = Math.max(0, offset - limit);
  const nextOffset = offset + limit;

  return (
    <nav
      aria-label="Pagination"
      className="mt-5 flex items-center justify-between"
    >
      <p className="text-sm text-ink-muted">
        Page {page} of {totalPages} · {total} meetings
      </p>
      <div className="flex gap-2">
        {hasPrev ? (
          <Link
            href={buildHref(prevOffset)}
            className="rounded-md border border-border-default bg-surface-0 px-3 py-1.5 text-sm font-medium text-ink-soft transition-colors hover:bg-surface-1"
          >
            Previous
          </Link>
        ) : (
          <span className="cursor-not-allowed rounded-md border border-border-subtle bg-surface-1 px-3 py-1.5 text-sm font-medium text-ink-faint">
            Previous
          </span>
        )}
        {hasNext ? (
          <Link
            href={buildHref(nextOffset)}
            className="rounded-md border border-border-default bg-surface-0 px-3 py-1.5 text-sm font-medium text-ink-soft transition-colors hover:bg-surface-1"
          >
            Next
          </Link>
        ) : (
          <span className="cursor-not-allowed rounded-md border border-border-subtle bg-surface-1 px-3 py-1.5 text-sm font-medium text-ink-faint">
            Next
          </span>
        )}
      </div>
    </nav>
  );
}
