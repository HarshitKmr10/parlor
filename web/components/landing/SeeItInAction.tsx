export function SeeItInAction() {
  return (
    <section
      id="demo"
      aria-labelledby="demo-heading"
      className="bg-surface-1 py-16 sm:py-20"
    >
      <div className="mx-auto max-w-[1000px] px-5 sm:px-8">
        <div className="mb-8 text-center">
          <p className="eyebrow mb-2">No mockups</p>
          <h2 id="demo-heading" className="font-display text-2xl text-ink sm:text-3xl">
            A real recorded session, not a staged screenshot
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-ink-muted">
            Sign in, open an AI-generated meeting summary, then ask a
            cross-meeting question and get back a cited answer — captured
            straight off the live product.
          </p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- animated GIF, next/image optimization doesn't preserve animation */}
        <img
          src="/demo/product-walkthrough.gif"
          alt="Real walkthrough: signing in, an AI-generated meeting summary, and a cross-meeting Ask answer with citations"
          width={960}
          height={600}
          loading="lazy"
          className="mx-auto w-full max-w-[960px] rounded-xl border border-border-subtle shadow-soft-md"
        />
      </div>
    </section>
  );
}
