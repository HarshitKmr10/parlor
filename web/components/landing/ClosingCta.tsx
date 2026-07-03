import Link from "next/link";
import { Reveal } from "./Reveal";
import { ArrowIcon } from "./icons";

export function ClosingCta() {
  return (
    <section id="start" aria-labelledby="cta-heading" className="bg-surface-0">
      <div className="mx-auto max-w-[1180px] px-5 py-20 sm:px-8 lg:py-28">
        <Reveal>
          <div className="grain relative overflow-hidden rounded-2xl border border-gold-200 bg-sage-900 px-7 py-16 text-center shadow-soft-xl sm:px-12 lg:py-20">
            {/* Gold bloom as a layered overlay — must NOT replace the dark
                panel background (the `background:` shorthand in .wash-gold would
                clobber bg-sage-900, which is what made the text invisible). */}
            <div
              className="wash-gold pointer-events-none absolute inset-0"
              aria-hidden="true"
            />
            {/* brass hairline crowning the panel */}
            <hr
              className="divider-gold absolute inset-x-12 top-0 z-10"
              aria-hidden="true"
            />

            <div className="relative z-10">
              <p className="eyebrow mb-5 text-gold-300">Start in minutes</p>
              <h2
                id="cta-heading"
                className="mx-auto max-w-xl text-balance text-[length:var(--text-2xl)] text-surface-cream"
              >
                Never take meeting notes again.
              </h2>
              <p className="mx-auto mt-5 max-w-md text-lg leading-relaxed text-sage-100">
                Self-hosted and free, no meeting caps. No credit card, no bot
                in the room, no scramble afterward.
              </p>

              <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/signup"
                  className="group inline-flex items-center gap-2 rounded-md bg-gold-400 px-7 py-3.5 text-base font-medium text-gold-800 shadow-soft-md transition-[background-color,transform] duration-200 hover:bg-gold-300 active:translate-y-px"
                >
                  Start free
                  <ArrowIcon
                    className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-0.5"
                    width={20}
                    height={20}
                  />
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
