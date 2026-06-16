import type { ReactNode } from "react";

type Props = {
  title: string;
  description?: string;
  children: ReactNode;
};

export function SettingsSection({ title, description, children }: Props) {
  return (
    <section className="grid gap-4 border-b border-border-subtle py-7 first:pt-0 last:border-0 lg:grid-cols-[220px_minmax(0,1fr)]">
      <div>
        <h2 className="font-display text-base text-ink">{title}</h2>
        {description && (
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">
            {description}
          </p>
        )}
      </div>
      <div>{children}</div>
    </section>
  );
}
