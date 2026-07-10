import Link from "next/link";
import { Reveal } from "./Reveal";
import { MeetingMock } from "./MeetingMock";
import { ArrowIcon } from "./icons";

export function Hero() {
  return (
    <section
      id="top"
      aria-labelledby="hero-heading"
      className="wash-hero grain relative overflow-hidden"
    >
      <div className="mx-auto grid max-w-[1180px] grid-cols-1 items-center gap-12 px-5 pb-20 pt-16 sm:px-8 sm:pt-24 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10 lg:pb-32 lg:pt-28">
        {/* Left: copy */}
        <div className="relative z-10 max-w-xl">
          <Reveal>
            <p className="eyebrow mb-5">AI meeting assistant</p>
          </Reveal>

          <Reveal delay={60}>
            <h1
              id="hero-heading"
              className="text-balance text-hero font-medium leading-[1.02] tracking-[-0.025em] text-ink"
            >
              Your meetings,{" "}
              <span className="text-sage-600">remembered.</span>
            </h1>
          </Reveal>

          <Reveal delay={120}>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-ink-soft">
              Parlor joins every call, transcribes in real time, and turns the
              conversation into summaries, action items, and answers you can
              simply ask for.
            </p>
          </Reveal>

          <Reveal delay={180}>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                href="/signup"
                className="rounded-md bg-sage-600 px-6 py-3 text-base font-medium text-surface-0 shadow-soft-md transition-[background-color,transform] duration-200 hover:bg-sage-700 active:translate-y-px"
              >
                Start free
              </Link>
              <a
                href="https://github.com/HarshitKmr10/parlor"
                className="group inline-flex items-center gap-2 rounded-md border border-border-default bg-surface-0/70 px-5 py-3 text-base font-medium text-ink transition-colors duration-200 hover:border-border-strong hover:bg-surface-0"
              >
                View on GitHub
                <ArrowIcon className="h-4 w-4 text-sage-600" width={16} height={16} />
              </a>
            </div>
          </Reveal>

          <Reveal delay={240}>
            <p className="mt-7 font-mono text-xs tracking-tight text-ink-muted">
              Works with Zoom, Google Meet &amp; Teams
            </p>
          </Reveal>
        </div>

        {/* Right: product mock, slightly offset for editorial asymmetry */}
        <Reveal delay={160} className="relative z-10 lg:translate-y-2">
          <div className="mx-auto max-w-md lg:mr-0 lg:max-w-none">
            <MeetingMock />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
