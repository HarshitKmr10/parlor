"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const GUIDES = [
  { href: "/developers/guides/quickstart", label: "Quickstart" },
  { href: "/developers/guides/botless-capture", label: "Botless capture" },
  { href: "/developers/guides/mock-mode-and-ask", label: "Mock mode & Ask" },
  { href: "/developers/guides/webhooks", label: "Webhooks" },
  { href: "/developers/guides/export", label: "Exporting meetings" },
  { href: "/developers/guides/rate-limits-and-quotas", label: "Rate limits & quotas" },
];

export function DevSidebar({ apiBaseUrl }: { apiBaseUrl: string }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Developer docs" className="lg:sticky lg:top-8">
      <p className="font-mono text-xs uppercase tracking-wider text-ink-faint">Guides</p>
      <ul className="mt-3 space-y-1.5">
        <li>
          <Link
            href="/developers"
            className={`block rounded-md px-2 py-1 text-sm transition-colors ${
              pathname === "/developers"
                ? "bg-surface-2 text-ink"
                : "text-ink-soft hover:text-ink"
            }`}
          >
            Overview
          </Link>
        </li>
        {GUIDES.map((g) => (
          <li key={g.href}>
            <Link
              href={g.href}
              className={`block rounded-md px-2 py-1 text-sm transition-colors ${
                pathname === g.href ? "bg-surface-2 text-ink" : "text-ink-soft hover:text-ink"
              }`}
            >
              {g.label}
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-6 font-mono text-xs uppercase tracking-wider text-ink-faint">
        API reference
      </p>
      <ul className="mt-3 space-y-1.5">
        <li>
          <a
            href={`${apiBaseUrl}/docs`}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-md px-2 py-1 text-sm text-ink-soft transition-colors hover:text-ink"
          >
            Swagger UI ↗
          </a>
        </li>
        <li>
          <a
            href={`${apiBaseUrl}/redoc`}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-md px-2 py-1 text-sm text-ink-soft transition-colors hover:text-ink"
          >
            ReDoc ↗
          </a>
        </li>
        <li>
          <a
            href={`${apiBaseUrl}/openapi.json`}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-md px-2 py-1 text-sm text-ink-soft transition-colors hover:text-ink"
          >
            OpenAPI spec ↗
          </a>
        </li>
      </ul>
    </nav>
  );
}
