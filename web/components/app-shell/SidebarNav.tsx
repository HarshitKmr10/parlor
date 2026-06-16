"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_LINKS } from "./navLinks";

type Props = {
  /** Called when a link is activated — used to close the mobile drawer. */
  onNavigate?: () => void;
};

export function SidebarNav({ onNavigate }: Props) {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="flex flex-1 flex-col gap-1 px-3 py-4">
      {NAV_LINKS.map((link) => {
        const isActive =
          pathname === link.href || pathname.startsWith(`${link.href}/`);
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isActive ? "page" : undefined}
            onClick={onNavigate}
            className={`group relative flex items-center gap-3 rounded-md px-3 py-2.5 font-sans text-sm font-medium transition-colors ${
              isActive
                ? "bg-sage-50 text-sage-700"
                : "text-ink-soft hover:bg-surface-1 hover:text-ink"
            }`}
          >
            {isActive && (
              <span
                aria-hidden="true"
                className="absolute top-1/2 left-0 h-5 w-0.5 -translate-y-1/2 rounded-full bg-gold-400"
              />
            )}
            <Icon
              className={`h-5 w-5 shrink-0 transition-colors ${
                isActive ? "text-sage-600" : "text-ink-faint group-hover:text-ink-muted"
              }`}
            />
            <span>{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
