import type { ReactNode } from "react";

type Props = {
  name: string;
  description: string;
  logo: ReactNode;
  children?: ReactNode;
  comingSoon?: boolean;
};

export function IntegrationCard({
  name,
  description,
  logo,
  children,
  comingSoon = false,
}: Props) {
  return (
    <div className="flex flex-col rounded-lg border border-border-subtle bg-surface-0 p-5 shadow-soft-sm">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-border-subtle bg-surface-1"
        >
          {logo}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-base text-ink">{name}</h3>
            {comingSoon && (
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-ink-muted">
                Coming soon
              </span>
            )}
          </div>
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">
            {description}
          </p>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}
