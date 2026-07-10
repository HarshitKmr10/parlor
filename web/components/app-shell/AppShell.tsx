"use client";

import { useState } from "react";
import { SidebarNav } from "./SidebarNav";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { UserMenu } from "./UserMenu";
import { NotificationBell } from "./NotificationBell";
import { NewMeetingButton } from "@/components/meetings/NewMeetingButton";
import { SearchBox } from "@/components/search/SearchBox";
import { CloseIcon, MenuIcon } from "@/components/ui/icons";
import { Wordmark } from "@/components/ui/Wordmark";

type Props = {
  children: React.ReactNode;
};

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
            Parlor · your meetings, remembered
          </p>
        </div>
      </aside>

      {/* Mobile drawer — backdrop, header, and panel are independent stacking
          layers (z-30/z-40/z-50) so the header's controls (notably the
          notification bell) stay above the backdrop and remain clickable
          instead of being trapped under a single full-screen z-50 wrapper. */}
      {isDrawerOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setIsDrawerOpen(false)}
          className="fixed inset-0 z-30 bg-ink/30 backdrop-blur-sm lg:hidden"
        />
      )}
      {isDrawerOpen && (
        <aside className="fixed inset-y-0 left-0 z-50 flex h-full w-72 flex-col border-r border-border-subtle bg-surface-0 shadow-soft-xl lg:hidden">
          <div className="flex h-16 items-center justify-between border-b border-border-subtle px-5">
            <Wordmark />
            <div className="flex items-center gap-1">
              {/* Below 640px the panel can overlap the top-bar bell, so the
                  drawer carries its own reachable instance. */}
              <div className="sm:hidden">
                <NotificationBell />
              </div>
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                aria-label="Close navigation"
                className="rounded-md p-1.5 text-ink-muted transition-colors hover:bg-surface-1"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
          <SidebarNav onNavigate={() => setIsDrawerOpen(false)} />
        </aside>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-40 flex h-16 min-w-0 items-center gap-3 border-b border-border-subtle bg-surface-0/85 px-4 backdrop-blur-md sm:px-6">
          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            aria-label="Open navigation"
            className="shrink-0 rounded-md p-1.5 text-ink-muted transition-colors hover:bg-surface-1 lg:hidden"
          >
            <MenuIcon className="h-5 w-5" />
          </button>

          <WorkspaceSwitcher />

          <div className="mx-auto hidden w-full max-w-md min-w-0 md:block">
            <SearchBox ariaLabel="Global search" placeholder="Search meetings…" />
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
            <NotificationBell />
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
