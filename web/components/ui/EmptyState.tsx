import type { ReactNode } from "react";

type Props = {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
};

export function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border-default bg-surface-1/60 px-6 py-16 text-center">
      {icon && (
        <div
          aria-hidden="true"
          className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-sage-50 text-sage-600"
        >
          {icon}
        </div>
      )}
      <h3 className="font-display text-lg text-ink">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-ink-muted">
        {description}
      </p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
