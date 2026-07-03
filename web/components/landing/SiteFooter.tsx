const REPO_URL = "https://github.com/HarshitKmr10/parlor";

type FooterColumn = {
  heading: string;
  links: { label: string; href: string }[];
};

const COLUMNS: FooterColumn[] = [
  {
    heading: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "API docs", href: "/developers" },
      { label: "Changelog", href: `${REPO_URL}/blob/main/CHANGELOG.md` },
    ],
  },
  {
    heading: "Open source",
    links: [
      { label: "GitHub", href: REPO_URL },
      { label: "License (FSL-1.1-Apache-2.0)", href: `${REPO_URL}/blob/main/LICENSE` },
      { label: "Contributing", href: `${REPO_URL}/blob/main/CONTRIBUTING.md` },
    ],
  },
  {
    heading: "Resources",
    links: [
      { label: "Self-hosting guide", href: `${REPO_URL}#try-it-in-2-minutes` },
      { label: "Security policy", href: `${REPO_URL}/security/policy` },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="bg-surface-1">
      <hr className="divider-gold" aria-hidden="true" />
      <div className="mx-auto max-w-[1180px] px-5 py-14 sm:px-8">
        <div className="grid grid-cols-2 gap-10 sm:grid-cols-4">
          <div className="col-span-2 sm:col-span-1">
            <p className="font-display text-xl font-medium tracking-tight text-ink">Parlor</p>
            <p className="mt-3 max-w-[14rem] text-sm leading-relaxed text-ink-muted">
              The self-hosted AI meeting assistant that remembers so you don&apos;t have to.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <nav key={column.heading} aria-label={column.heading}>
              <h2 className="font-mono text-xs uppercase tracking-wider text-ink-faint">
                {column.heading}
              </h2>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
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
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-border-subtle pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-ink-muted">© 2026 The Parlor Contributors</p>
          <ul className="flex gap-6">
            <li>
              <a
                href={`${REPO_URL}/blob/main/LICENSE`}
                className="text-xs text-ink-muted transition-colors hover:text-ink"
              >
                License
              </a>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
