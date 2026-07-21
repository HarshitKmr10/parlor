import { Reveal } from "./Reveal";

type Step = {
  numeral: string;
  title: string;
  description: string;
};

const STEPS: Step[] = [
  {
    numeral: "01",
    title: "Run it yourself",
    description: "Self-host Parlor in minutes. Start with zero API keys in mock mode, or plug in your own — nothing phones home.",
  },
  {
    numeral: "02",
    title: "Let it listen",
    description: "It transcribes your calls and tracks who said what — every transcript stays on your own machine.",
  },
  {
    numeral: "03",
    title: "Get the recap",
    description: "Summary, action items, and a searchable record, all processed locally and never sent to anyone else's cloud.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-heading"
      className="grain relative overflow-hidden bg-surface-cream"
    >
      <div className="mx-auto max-w-[1180px] px-5 py-20 sm:px-8 lg:py-28">
        <div className="max-w-2xl">
          <Reveal>
            <p className="eyebrow mb-4">How it works</p>
          </Reveal>
          <Reveal delay={60}>
            <h2 id="how-heading" className="text-2xl text-ink">
              Self-hosted in under two minutes
            </h2>
          </Reveal>
        </div>

        <ol className="mt-14 grid grid-cols-1 gap-x-10 gap-y-12 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <Reveal key={step.numeral} delay={index * 90} as="li">
              <div className="relative">
                <span
                  aria-hidden="true"
                  className="font-display text-3xl font-medium leading-none text-gold-300"
                >
                  {step.numeral}
                </span>
                <hr className="divider-gold mt-5 w-12" aria-hidden="true" />
                <h3 className="mt-5 text-xl text-ink">{step.title}</h3>
                <p className="mt-3 max-w-xs text-base leading-relaxed text-ink-soft">
                  {step.description}
                </p>
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
