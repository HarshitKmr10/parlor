import { Reveal } from "./Reveal";

const COMPANIES = ["Northwind", "Lumen", "Atlas Labs", "Cedar", "Marlow", "Verge"] as const;

export function LogoStrip() {
  return (
    <section aria-label="Customers" id="customers" className="border-y border-border-subtle bg-surface-0">
      <div className="mx-auto max-w-[1180px] px-5 py-10 sm:px-8">
        <Reveal>
          <p className="text-center font-mono text-xs uppercase tracking-[0.14em] text-ink-faint">
            Trusted by teams at
          </p>
          <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-5 sm:gap-x-14">
            {COMPANIES.map((name) => (
              <li
                key={name}
                className="font-display text-lg font-medium tracking-tight text-ink-faint transition-colors duration-300 hover:text-ink-muted"
              >
                {name}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
