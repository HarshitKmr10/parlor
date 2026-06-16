import Link from "next/link";

/**
 * Left-hand brand panel for the auth screens — warm sage hero wash with grain,
 * a wordmark, a one-line value prop, and a quiet testimonial-style proof line.
 */
export function AuthBrandPanel() {
  return (
    <section
      aria-hidden="false"
      className="wash-hero grain relative hidden flex-col justify-between overflow-hidden p-10 lg:flex"
    >
      <Link
        href="/"
        className="relative z-10 flex w-fit items-center gap-2 font-display text-2xl font-medium tracking-tight text-ink"
      >
        <span
          aria-hidden="true"
          className="grid h-8 w-8 place-items-center rounded-md bg-sage-600 text-surface-cream"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
            <path
              d="M12 21c5-3 7-7 7-11V5l-7-2-7 2v5c0 4 2 8 7 11Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <path
              d="M9 11.5 11 14l4-5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        Verdant
      </Link>

      <div className="relative z-10 max-w-md">
        <p className="eyebrow mb-4">Your meetings, remembered</p>
        <h1 className="font-display text-3xl leading-tight text-ink">
          Every conversation, distilled into summaries, action items, and
          answers you can simply ask for.
        </h1>
        <hr className="divider-gold my-7" aria-hidden="true" />
        <p className="text-base leading-relaxed text-ink-soft">
          Verdant joins your calls, transcribes in real time, and turns the
          noise into a searchable record your whole team can rely on.
        </p>
      </div>

      <p className="relative z-10 text-sm text-ink-muted">
        Trusted by teams who&rsquo;d rather build than take notes.
      </p>
    </section>
  );
}
