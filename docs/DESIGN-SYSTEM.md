# Verdant — Design System

> Premium AI meeting assistant · **sage-on-white**, warm-precise, YC-grade.
> Editorial-organic: Stripe's typographic discipline + Linear's restraint, in a warm daylight palette —
> deep olive ink on layered creams, with **brass used like jewelry, not paint**. Not dark mode.

OKLCH is the source of truth; hex is the sRGB fallback. Two greens with different jobs:
**sage** (hue ~128, the calm UI 90%) and **gold/brass** (hue ~78, the warm punctuation).

```css
:root {
  /* ── SURFACES — the page is never pure #FFF; layers warm as they recede ── */
  --surface-0:        #FCFBF7;  /* app canvas, warm white */
  --surface-1:        #F7F5EE;  /* cards / raised */
  --surface-2:        #F1EDE2;  /* insets, wells */
  --surface-3:        #E9E3D4;  /* deeper inset / hover well */
  --surface-cream:    #F4F0E4;  /* hero / section wash base */
  --surface-overlay:  #FFFFFFE6;/* glass overlay for menus */

  /* ── SAGE / OLIVE — primary brand scale (hue ~128) ── */
  --sage-50:  #EEF1E6;  --sage-100: #DFE5D0;  --sage-200: #C7D1B0;
  --sage-300: #AAB98C;  --sage-400: #8A9C6A;  --sage-500: #6E8050;
  --sage-600: #5C6B4A;  /* ← PRIMARY BRAND */
  --sage-700: #47543A;  --sage-800: #353F2D;  --sage-900: #262D22;

  /* ── OLIVE INK — text family (never pure black) ── */
  --olive-ink:       #2A2E22;  /* ← MAIN TEXT (13.8:1 on surface-0, AAA) */
  --olive-ink-soft:  #4A4F40;  /* secondary (8.9:1) */
  --olive-ink-muted: #6E7263;  /* tertiary/captions (4.9:1 AA, keep ≥14px) */
  --olive-ink-faint: #9A9C8E;  /* placeholders/disabled — decorative only */

  /* ── GOLD / BRASS — accent (hue ~78); warm, never neon ── */
  --gold-50:  #FAF3E2;  --gold-100: #F3E6C6;  --gold-200: #E8D29C;
  --gold-300: #D9B86F;  --gold-400: #C9A04F;
  --gold-500: #B8893B;  /* ← ACCENT (fills/strokes/glows, not white-text bg) */
  --gold-600: #9C7130;  --gold-700: #7C5926;  /* ← use for gold TEXT (5.1:1 AA) */
  --gold-800: #5E431E;

  /* ── SEMANTIC — tuned into the sage/brass world ── */
  --success: #5E7D3E;  --success-bg: #EAF0DC;
  --warning: #B8893B;  --warning-bg: #FAF1DC;
  --error:   #B14A38;  --error-bg:   #F8E6E0;  /* warm terracotta, not pink-red */
  --info:    #4A6B73;  --info-bg:    #E4ECEC;  /* muted slate-teal, the one cool note */

  /* ── BORDERS ── */
  --border-subtle:  #E6E1D4;  --border-default: #D8D2C2;
  --border-strong:  #BDB6A2;  --border-gold:    #D9B86F66; /* brass hairline @ 40% */

  /* ── SEMANTIC ALIASES (use these in components) ── */
  --color-brand: var(--sage-600);  --color-brand-hover: var(--sage-700);
  --color-accent: var(--gold-500); --color-text: var(--olive-ink);
  --color-text-2: var(--olive-ink-soft); --color-text-3: var(--olive-ink-muted);
  --color-bg: var(--surface-0); --color-card: var(--surface-1);

  /* ── TYPOGRAPHY ── (ship: Fraunces display + Inter body + Geist Mono) */
  --font-display: "Fraunces", "Times New Roman", serif;
  --font-body:    "Inter", system-ui, -apple-system, sans-serif;
  --font-mono:    "Geist Mono", "JetBrains Mono", ui-monospace, monospace;
  --text-xs:   clamp(0.75rem, 0.73rem + 0.10vw, 0.8125rem);
  --text-sm:   clamp(0.875rem, 0.85rem + 0.12vw, 0.9375rem);
  --text-base: clamp(1rem, 0.96rem + 0.20vw, 1.125rem);
  --text-lg:   clamp(1.1875rem, 1.12rem + 0.34vw, 1.375rem);
  --text-xl:   clamp(1.5rem, 1.35rem + 0.75vw, 2rem);
  --text-2xl:  clamp(2rem, 1.7rem + 1.5vw, 3rem);
  --text-3xl:  clamp(2.75rem, 2.1rem + 3.25vw, 4.5rem);
  --text-hero: clamp(3.25rem, 2.0rem + 6.25vw, 7rem);
  --leading-display: 1.04; --leading-tight: 1.18; --leading-body: 1.6; --leading-relaxed: 1.7;
  --tracking-display: -0.02em; --tracking-body: -0.005em; --tracking-label: 0.06em;

  /* ── SPACING (4px base) ── */
  --space-1: 0.25rem; --space-2: 0.5rem; --space-3: 0.75rem; --space-4: 1rem;
  --space-5: 1.5rem; --space-6: 2rem; --space-7: 3rem; --space-8: 4rem; --space-9: 6rem;
  --space-section: clamp(4rem, 3rem + 5vw, 8.5rem);
  --space-gutter:  clamp(1.25rem, 0.5rem + 3vw, 2.5rem);

  /* ── RADII — soft, NOT pill (the YC tell) ── */
  --radius-xs: 4px; --radius-sm: 7px; --radius-md: 11px; --radius-lg: 16px;
  --radius-xl: 22px; --radius-2xl: 30px; --radius-full: 9999px;

  /* ── SHADOWS — warm-tinted (olive hue), multi-layer, low-spread ── */
  --shadow-xs: 0 1px 2px oklch(35% 0.02 120 / 0.05);
  --shadow-sm: 0 1px 2px oklch(35% 0.02 120 / 0.05), 0 2px 4px oklch(35% 0.02 120 / 0.04);
  --shadow-md: 0 2px 4px oklch(35% 0.02 120 / 0.05), 0 6px 12px oklch(35% 0.02 120 / 0.06), 0 12px 24px oklch(35% 0.02 120 / 0.05);
  --shadow-lg: 0 4px 8px oklch(35% 0.02 120 / 0.05), 0 12px 24px oklch(35% 0.02 120 / 0.07), 0 24px 48px oklch(35% 0.02 120 / 0.07);
  --shadow-xl: 0 8px 16px oklch(35% 0.02 120 / 0.06), 0 24px 48px oklch(35% 0.02 120 / 0.09), 0 48px 96px oklch(30% 0.02 120 / 0.08);
  --glow-gold: 0 0 0 1px var(--gold-300), 0 0 24px oklch(66% 0.11 78 / 0.25);
  --shadow-inset: inset 0 1px 2px oklch(35% 0.02 120 / 0.07);
  --ring: 0 0 0 3px oklch(66% 0.11 78 / 0.35); /* brass focus ring */

  /* ── ATMOSPHERE ── */
  --wash-hero: radial-gradient(120% 100% at 50% -20%, var(--sage-50) 0%, var(--surface-cream) 38%, var(--surface-0) 72%);
  --wash-gold: radial-gradient(60% 60% at 70% 30%, oklch(66% 0.11 78 / 0.10) 0%, transparent 70%);
  --divider-gold: linear-gradient(90deg, transparent, var(--gold-300) 18%, var(--gold-400) 50%, var(--gold-300) 82%, transparent);

  /* ── MOTION ── */
  --dur-instant: 80ms; --dur-fast: 150ms; --dur-normal: 240ms; --dur-slow: 360ms; --dur-reveal: 640ms;
  --ease-out-soft: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-out-expo: cubic-bezier(0.16, 1, 0.30, 1);
  --ease-in-out:   cubic-bezier(0.65, 0, 0.35, 1);
  --ease-spring:   cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

## Rules of thumb
- **Brass is jewelry:** hairlines, focus rings, active-speaker glow, exactly **one** CTA per page. Gold text uses `--gold-700`; never white text on a gold fill.
- **Depth from value, then shadow:** stack `surface-0` page → `surface-1` cards → `surface-2` wells. Shadows are olive-tinted, never pure black (they'd go grey/dirty on cream).
- **Grain + washes** are decorative `::after` layers (3–5% grain, multiply) — gate behind `prefers-reduced-transparency`.
- **Motion** animates only `transform`/`opacity`/`clip-path`; gate everything behind `prefers-reduced-motion`.

## Signature surface — live "people talking" view
- Speaker rows on `--surface-1`; the **active speaker** gets a `--radius-full` brass ring + `--glow-gold` pulsing subtly (~1.4s) while talking.
- Each speaker keyed to a **sage-scale** tint (300/400/500) — not rainbow. Gold reserved strictly for "active now."
- Transcript in Inter `--text-base`/`--leading-relaxed`; timestamps + speaker labels in mono/small-caps `--olive-ink-muted`.
- AI-extracted action items: 2px `--border-gold` left border on a `--gold-50` well with a Fraunces label — an editorial margin annotation, not a notification badge.
- New transcript lines enter with `--ease-spring` translate-up + fade (`--dur-normal`), respecting reduced-motion.

## Typography options
- **Ship:** Fraunces (display, warm-editorial) + Inter (body). Mono: Geist Mono.
- **Alt B (geometric, no serif):** Bricolage Grotesque + Inter.
- **Alt C (single foundry, lowest risk):** DM Serif Display + DM Sans.

_Caveat: OKLCH/hex pairs are hand-tuned, not bit-identical — regenerate hex from OKLCH for pixel parity. Re-verify borderline contrast (`--olive-ink-muted` 4.9:1, `--gold-700` 5.1:1) once grain/wash overlays composite._
