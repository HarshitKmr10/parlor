type Props = {
  /** What the page was trying to load, e.g. "your meetings". */
  resource?: string;
};

/**
 * Friendly "backend not connected" state. Shown when the API client throws a
 * `backend_unavailable` error so pages render intentionally rather than crash.
 */
export function BackendDownState({ resource = "your data" }: Props) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gold-300/70 bg-gold-50/50 px-6 py-16 text-center">
      <div
        aria-hidden="true"
        className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-gold-100 text-gold-700"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7">
          <path
            d="M12 9v4m0 4h.01M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.42 0Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <h3 className="font-display text-lg text-ink">Backend not connected</h3>
      <p className="mt-1.5 max-w-md text-sm leading-relaxed text-ink-muted">
        We couldn&rsquo;t reach the Parlor API to load {resource}. Start the
        backend service, then refresh this page. The interface stays available
        so you can keep exploring.
      </p>
    </div>
  );
}
