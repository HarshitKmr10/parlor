"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { CheckIcon, ChevronDownIcon } from "@/components/ui/icons";

export function WorkspaceSwitcher() {
  const { workspaces, currentWorkspace, switchWorkspace, isSwitching } =
    useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const handleSelect = async (workspaceId: string) => {
    setIsOpen(false);
    await switchWorkspace(workspaceId);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        disabled={isSwitching}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="flex items-center gap-2 rounded-md border border-border-subtle bg-surface-0 px-2.5 py-1.5 transition-colors hover:border-border-default disabled:opacity-60"
      >
        <span
          aria-hidden="true"
          className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-sage-600 font-display text-xs font-semibold text-surface-cream"
        >
          {currentWorkspace.name.charAt(0).toUpperCase()}
        </span>
        <span className="max-w-[10rem] truncate text-sm font-medium text-ink">
          {currentWorkspace.name}
        </span>
        <ChevronDownIcon className="h-4 w-4 text-ink-faint" />
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute top-full left-0 z-50 mt-2 w-64 overflow-hidden rounded-lg border border-border-subtle bg-surface-0 py-1 shadow-soft-lg"
        >
          <p className="eyebrow px-3 pt-2 pb-1">Workspaces</p>
          {workspaces.map((workspace) => {
            const isCurrent = workspace.id === currentWorkspace.id;
            return (
              <button
                key={workspace.id}
                type="button"
                role="menuitem"
                onClick={() => handleSelect(workspace.id)}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-surface-1"
              >
                <span
                  aria-hidden="true"
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-surface-2 font-display text-xs font-semibold text-ink-soft"
                >
                  {workspace.name.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">
                    {workspace.name}
                  </span>
                  <span className="block text-xs text-ink-muted capitalize">
                    {workspace.role}
                  </span>
                </span>
                {isCurrent && (
                  <CheckIcon className="h-4 w-4 shrink-0 text-sage-600" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
