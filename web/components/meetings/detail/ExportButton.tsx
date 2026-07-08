"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

type Props = {
  meetingId: string;
};

export function ExportButton({ meetingId }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <Button variant="secondary" size="sm" onClick={() => setOpen((v) => !v)}>
        Export
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-10 mt-2 w-72 rounded-lg border border-border-default bg-surface-0 p-2 shadow-soft-md"
        >
          <a
            role="menuitem"
            href={`/api/meetings/${meetingId}/export?format=markdown`}
            download
            data-testid="export-markdown-link"
            onClick={() => setOpen(false)}
            className="block rounded-md px-3 py-2 text-sm text-ink hover:bg-surface-1"
          >
            <span className="font-medium">Markdown (.md)</span>
            <span className="mt-0.5 block text-xs text-ink-muted">
              Summary, action items and transcript excerpts. Drop the file
              into an Obsidian vault or use Notion&apos;s Import → Markdown to
              bring it in — no extra setup needed.
            </span>
          </a>
          <div
            aria-disabled="true"
            className="mt-1 block cursor-not-allowed rounded-md px-3 py-2 text-sm text-ink-muted opacity-60"
          >
            <span className="font-medium">PDF</span>
            <span className="mt-0.5 block text-xs">Coming soon.</span>
          </div>
        </div>
      )}
    </div>
  );
}
