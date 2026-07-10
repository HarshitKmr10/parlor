"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Wordmark } from "@/components/ui/Wordmark";
import { CloseIcon, MenuIcon } from "@/components/ui/icons";

const NAV_LINKS = [
  { label: "Product", href: "#features" },
  { label: "Docs", href: "/developers" },
] as const;

const SCROLL_THRESHOLD = 12;

export function SiteNav() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > SCROLL_THRESHOLD);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!isMenuOpen) return;
    const handleResize = () => {
      if (window.innerWidth >= 768) setIsMenuOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isMenuOpen]);

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
          <Wordmark href="#top" />

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
            <button
              type="button"
              onClick={() => setIsMenuOpen((open) => !open)}
              aria-label={isMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={isMenuOpen}
              aria-controls="site-nav-mobile-menu"
              className="rounded-md p-1.5 text-ink-soft transition-colors hover:bg-surface-1 hover:text-ink md:hidden"
            >
              {isMenuOpen ? <CloseIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {isMenuOpen && (
          <div
            id="site-nav-mobile-menu"
            className="border-t border-border-subtle bg-surface-0/95 px-5 py-4 backdrop-blur-md motion-safe:animate-[site-nav-menu-in_220ms_var(--ease-out-soft)] sm:px-8 md:hidden"
          >
            <ul className="flex flex-col gap-1">
              {NAV_LINKS.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    onClick={() => setIsMenuOpen(false)}
                    className="block rounded-md px-3 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:bg-surface-1 hover:text-ink"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

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
