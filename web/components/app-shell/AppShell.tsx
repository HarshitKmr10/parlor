"use client";

import { useState } from "react";
import Link from "next/link";
import { SidebarNav } from "./SidebarNav";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { UserMenu } from "./UserMenu";
import { NewMeetingButton } from "@/components/meetings/NewMeetingButton";
import { CloseIcon, MenuIcon } from "@/components/ui/icons";

type Props = {
  children: React.ReactNode;
};

function Wordmark() {
  return (
    <Link
      href="/dashboard"
      className="flex items-center gap-2 font-display text-[1.4rem] font-medium tracking-tight text-ink"
    >
      <span
        aria-hidden="true"
        className="grid h-7 w-7 place-items-center rounded-md bg-sage-600 text-surface-cream"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
          <path
            d="M12 21c5-3 7-7 7-11V5l-7-2-7 2v5c0 4 2 8 7 11Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path
            d="M9 11.5 11 14l4-5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      Verdant
    </Link>
  );
}

export function AppShell({ children }: Props) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  return (
    <div className="flex min-h-dvh bg-surface-1">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border-subtle bg-surface-0 lg:flex">
        <div className="flex h-16 items-center border-b border-border-subtle px-5">
          <Wordmark />
        </div>
        <SidebarNav />
        <div className="border-t border-border-subtle p-3">
          <p className="px-3 py-1 text-xs text-ink-faint">
            Verdant · your meetings, remembered
          </p>
        </div>
      </aside>

      {/* Mobile drawer */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setIsDrawerOpen(false)}
            className="absolute inset-0 bg-ink/30 backdrop-blur-sm"
          />
          <aside className="absolute top-0 left-0 flex h-full w-72 flex-col border-r border-border-subtle bg-surface-0 shadow-soft-xl">
            <div className="flex h-16 items-center justify-between border-b border-border-subtle px-5">
              <Wordmark />
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                aria-label="Close navigation"
                className="rounded-md p-1.5 text-ink-muted transition-colors hover:bg-surface-1"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>
            <SidebarNav onNavigate={() => setIsDrawerOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-border-subtle bg-surface-0/85 px-4 backdrop-blur-md sm:px-6">
          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            aria-label="Open navigation"
            className="rounded-md p-1.5 text-ink-muted transition-colors hover:bg-surface-1 lg:hidden"
          >
            <MenuIcon className="h-5 w-5" />
          </button>

          <WorkspaceSwitcher />

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <NewMeetingButton />
            <UserMenu />
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
