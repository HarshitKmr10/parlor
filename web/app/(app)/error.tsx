"use client";

import { Button } from "@/components/ui/Button";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AppError({ reset }: Props) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
      <div
        aria-hidden="true"
        className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-error-bg text-error"
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
      <h1 className="font-display text-xl text-ink">Something went wrong</h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        We hit an unexpected error rendering this page. You can try again.
      </p>
      <Button className="mt-6" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
