type FooterColumn = {
  heading: string;
  links: string[];
};

const COLUMNS: FooterColumn[] = [
  { heading: "Product", links: ["Features", "Pricing", "Integrations", "Changelog"] },
  { heading: "Company", links: ["About", "Customers", "Careers", "Blog"] },
  { heading: "Resources", links: ["Docs", "API", "Security", "Status"] },
];

export function SiteFooter() {
  return (
    <footer className="bg-surface-1">
      <hr className="divider-gold" aria-hidden="true" />
      <div className="mx-auto max-w-[1180px] px-5 py-14 sm:px-8">
        <div className="grid grid-cols-2 gap-10 sm:grid-cols-4">
          <div className="col-span-2 sm:col-span-1">
            <p className="font-display text-xl font-medium tracking-tight text-ink">Verdant</p>
            <p className="mt-3 max-w-[14rem] text-sm leading-relaxed text-ink-muted">
              The AI meeting assistant that remembers so you don&apos;t have to.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <nav key={column.heading} aria-label={column.heading}>
              <h2 className="font-mono text-xs uppercase tracking-wider text-ink-faint">
                {column.heading}
              </h2>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-sm text-ink-soft transition-colors hover:text-ink"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-border-subtle pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-ink-muted">© 2026 Verdant Labs, Inc.</p>
          <ul className="flex gap-6">
            <li>
              <a href="#" className="text-xs text-ink-muted transition-colors hover:text-ink">
                Privacy
              </a>
            </li>
            <li>
              <a href="#" className="text-xs text-ink-muted transition-colors hover:text-ink">
                Terms
              </a>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
