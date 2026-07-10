import type { ReactNode } from "react";

type CardProps = {
  title: string;
  description?: string;
  badge?: ReactNode;
  children: ReactNode;
};

/** Parlor-styled settings card used across the Google Workspace surface. */
export function Card({ title, description, badge, children }: CardProps) {
  return (
    <section className="rounded-lg border border-border-subtle bg-surface-0 p-4 shadow-soft-sm sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-base text-ink">{title}</h2>
          {description && (
            <p className="mt-1 text-sm leading-relaxed text-ink-muted">
              {description}
            </p>
          )}
        </div>
        {badge && <div className="shrink-0">{badge}</div>}
      </div>
      {children}
    </section>
  );
}

/** Small pill used for connection status. */
export function StatusBadge({
  tone,
  children,
}: {
  tone: "ok" | "muted" | "warn";
  children: ReactNode;
}) {
  const toneClass =
    tone === "ok"
      ? "bg-sage-50 text-sage-700 border border-sage-200"
      : tone === "warn"
        ? "bg-gold-50 text-gold-800 border border-gold-200"
        : "bg-surface-2 text-ink-muted border border-border-subtle";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${toneClass}`}
    >
      {children}
    </span>
  );
}
