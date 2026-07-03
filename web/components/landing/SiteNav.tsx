"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";

const NAV_LINKS = [
  { label: "Product", href: "#features" },
  { label: "Docs", href: "/developers" },
] as const;

const SCROLL_THRESHOLD = 12;

export function SiteNav() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > SCROLL_THRESHOLD);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className="sticky top-0 z-50">
      <nav
        aria-label="Main navigation"
        className="relative bg-surface-0/80 backdrop-blur-md backdrop-saturate-150"
        style={{
          transition: "background-color var(--duration, 300ms) var(--ease-out-soft)",
          backgroundColor: isScrolled ? "rgba(252,251,247,0.82)" : "rgba(252,251,247,0.55)",
        }}
      >
        <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-6 px-5 py-3.5 sm:px-8">
          <a
            href="#top"
            className="flex items-center gap-2 font-display text-[1.35rem] font-medium tracking-tight text-ink"
          >
            <Image src="/logo.svg" alt="" width={28} height={28} className="shrink-0" priority />
            Parlor
          </a>

          <ul className="hidden items-center gap-7 md:flex">
            {NAV_LINKS.map((link) => (
              <li key={link.label}>
                <a
                  href={link.href}
                  className="text-sm text-ink-soft transition-colors hover:text-ink"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-1.5 sm:gap-3">
            <Link
              href="/login"
              className="rounded-md px-3 py-2 text-sm font-medium text-ink-soft transition-colors hover:text-ink"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-md bg-sage-600 px-4 py-2 text-sm font-medium text-surface-0 shadow-soft-sm transition-[background-color,transform] duration-200 hover:bg-sage-700 active:translate-y-px"
            >
              Start free
            </Link>
          </div>
        </div>

        <hr
          className="divider-gold absolute inset-x-0 bottom-0"
          aria-hidden="true"
          style={{
            opacity: isScrolled ? 1 : 0,
            transition: "opacity 360ms var(--ease-out-soft)",
          }}
        />
      </nav>
    </header>
  );
}
