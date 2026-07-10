"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { WORKSPACE_ACCESS_ERROR_MESSAGE } from "@/lib/api/error";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

const LINK_BUTTON_CLASSES =
  "mt-6 inline-flex items-center justify-center gap-2 rounded-md bg-sage-600 px-4 py-2.5 text-sm font-sans font-medium text-surface-cream shadow-soft-sm transition-[background-color,box-shadow,transform] duration-200 hover:bg-sage-700 active:translate-y-px";

export default function AppError({ error, reset }: Props) {
  // Error boundaries only preserve `message`/`digest` across the server ->
  // client serialization boundary, so a stale/mismatched workspace (revoked
  // membership, switched account, stale cookie) is matched by message here
  // rather than by the ApiError's `code`/`status`, which don't survive it.
  const isWorkspaceAccess = error.message === WORKSPACE_ACCESS_ERROR_MESSAGE;

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
      {isWorkspaceAccess ? (
        <>
          <h1 className="font-display text-xl text-ink">
            You no longer have access to this workspace
          </h1>
          <p className="mt-1.5 text-sm text-ink-muted">
            Your account may have switched, or your membership may have been
            removed. Sign in again to pick a workspace you have access to.
          </p>
          <Link href="/login?reason=workspace_access" className={LINK_BUTTON_CLASSES}>
            Back to sign in
          </Link>
        </>
      ) : (
        <>
          <h1 className="font-display text-xl text-ink">Something went wrong</h1>
          <p className="mt-1.5 text-sm text-ink-muted">
            We hit an unexpected error rendering this page. You can try again.
          </p>
          <Button className="mt-6" onClick={reset}>
            Try again
          </Button>
        </>
      )}
    </div>
  );
}
