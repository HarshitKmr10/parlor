export function GuideHeader({
  eyebrow,
  title,
  desc,
}: {
  eyebrow: string;
  title: string;
  desc: string;
}) {
  return (
    <header className="mb-6">
      <p className="eyebrow mb-1.5">{eyebrow}</p>
      <h1 className="font-display text-2xl text-ink">{title}</h1>
      <p className="mt-1.5 max-w-xl text-sm text-ink-muted">{desc}</p>
    </header>
  );
}

export function GuideSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 font-display text-lg text-ink">{title}</h2>
      {children}
    </section>
  );
}

export function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-border-subtle bg-surface-1 p-4 font-mono text-xs leading-relaxed text-ink-soft">
      <code>{children}</code>
    </pre>
  );
}

export function SourceNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 text-xs text-ink-faint">
      <span className="font-mono uppercase tracking-wider">Source: </span>
      {children}
    </p>
  );
}
