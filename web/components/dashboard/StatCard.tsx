import type { ReactNode } from "react";

type Props = {
  label: string;
  value: string;
  hint?: string;
  icon: ReactNode;
  accent?: boolean;
};

export function StatCard({ label, value, hint, icon, accent = false }: Props) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-border-subtle bg-surface-0 p-5 shadow-soft-sm">
      {accent && (
        <span
          aria-hidden="true"
          className="absolute top-0 right-0 h-20 w-20 translate-x-6 -translate-y-6 rounded-full bg-gold-100/60 blur-2xl"
        />
      )}
      <div className="relative flex items-start justify-between gap-3">
        <p className="eyebrow">{label}</p>
        <span
          aria-hidden="true"
          className={`grid h-8 w-8 place-items-center rounded-md ${
            accent ? "bg-gold-50 text-gold-700" : "bg-sage-50 text-sage-600"
          }`}
        >
          {icon}
        </span>
      </div>
      <p className="relative mt-3 font-display text-3xl tracking-tight text-ink tabular-nums">
        {value}
      </p>
      {hint && <p className="relative mt-1 text-sm text-ink-muted">{hint}</p>}
    </div>
  );
}
