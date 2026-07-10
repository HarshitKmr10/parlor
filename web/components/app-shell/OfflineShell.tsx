import { BackendDownState } from "@/components/ui/BackendDownState";
import { Wordmark } from "@/components/ui/Wordmark";

type Props = {
  children: React.ReactNode;
};

/**
 * Fallback shell used when /auth/me can't be reached. Renders the brand frame
 * plus a friendly offline banner instead of crashing the whole app tree.
 */
export function OfflineShell({ children }: Props) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface-1">
      <header className="flex h-16 items-center border-b border-border-subtle bg-surface-0 px-4 sm:px-6">
        <Wordmark />
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">
        <BackendDownState resource="your workspace" />
        <div className="mt-8 opacity-50">{children}</div>
      </main>
    </div>
  );
}
