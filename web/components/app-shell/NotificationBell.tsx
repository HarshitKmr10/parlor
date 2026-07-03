"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getJson, postJson } from "@/lib/api/browser";
import { BellIcon } from "@/components/ui/icons";
import { formatRelative } from "@/lib/format";
import type { NotificationListResponse, Notification } from "@/lib/api/types";

const POLL_MS = 30_000;

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  // Poll for notifications. `cancelled`/`inFlight` are plain closure locals
  // (not refs) because this effect never re-runs mid-lifetime (empty deps) —
  // they live exactly as long as the subscription they guard. Every setState
  // call is gated on `cancelled` so a response that resolves after unmount
  // (or after a newer poll superseded it) can never update state, and
  // `inFlight` stops overlapping polls from racing each other out of order.
  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    const controller = new AbortController();

    const load = async () => {
      if (cancelled || inFlight) return;
      inFlight = true;
      try {
        const res = await getJson<NotificationListResponse>(
          "/api/notifications",
          controller.signal,
        );
        if (cancelled) return;
        setItems(res.items);
        setUnread(res.unread);
      } catch {
        // Silent — the bell is non-critical chrome.
      } finally {
        inFlight = false;
      }
    };

    void load();
    const id = setInterval(() => void load(), POLL_MS);
    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(id);
    };
  }, []);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const openNotification = async (n: Notification) => {
    if (!n.read) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
      void postJson(`/api/notifications/${n.id}/read`, {}).catch(() => {});
    }
    setOpen(false);
    if (n.link) router.push(n.link);
  };

  const markAll = async () => {
    setItems((prev) => prev.map((x) => ({ ...x, read: true })));
    setUnread(0);
    void postJson("/api/notifications/read-all", {}).catch(() => {});
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`}
        aria-haspopup="true"
        aria-expanded={open}
        className="relative rounded-md p-1.5 text-ink-muted transition-colors hover:bg-surface-1 hover:text-ink"
      >
        <BellIcon className="h-5 w-5" />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-gold-500 px-1 text-[10px] font-semibold text-surface-cream"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-lg border border-border-subtle bg-surface-0 shadow-soft-lg"
        >
          <div className="flex items-center justify-between border-b border-border-subtle px-4 py-2.5">
            <span className="font-display text-sm text-ink">Notifications</span>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAll}
                className="text-xs text-ink-muted hover:text-sage-700"
              >
                Mark all read
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-muted">
              You&apos;re all caught up.
            </p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => openNotification(n)}
                    className={`flex w-full flex-col gap-0.5 border-b border-border-subtle px-4 py-3 text-left transition-colors hover:bg-surface-1 ${
                      n.read ? "" : "bg-sage-50/40"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {!n.read && (
                        <span
                          aria-hidden="true"
                          className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold-500"
                        />
                      )}
                      <span className="text-sm font-medium text-ink">{n.title}</span>
                    </span>
                    {n.body && (
                      <span className="line-clamp-2 text-xs text-ink-muted">{n.body}</span>
                    )}
                    <span className="text-xs text-ink-faint">{formatRelative(n.createdAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
