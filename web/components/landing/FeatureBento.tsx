import type { ReactNode } from "react";
import { Reveal } from "./Reveal";
import {
  CalendarIcon,
  WaveformIcon,
  SparkIcon,
  ChatIcon,
  DesktopIcon,
  PlugIcon,
} from "./icons";

type Feature = {
  icon: ReactNode;
  title: string;
  description: string;
  /** Tailwind column/row span classes for the bento layout. */
  span: string;
  /** When true, a faint brass bloom sits in the corner. */
  hasGoldWash?: boolean;
};

const FEATURES: Feature[] = [
  {
    icon: <WaveformIcon />,
    title: "Live transcription & speaker view",
    description:
      "Word-perfect transcripts as people talk, with automatic speaker labels and an at-a-glance active-speaker view.",
    span: "lg:col-span-3 lg:row-span-2",
    hasGoldWash: true,
  },
  {
    icon: <CalendarIcon />,
    title: "Calendar auto-join",
    description: "Parlor watches your calendar and slips into every meeting on time, so you never press record.",
    span: "lg:col-span-3",
  },
  {
    icon: <SparkIcon />,
    title: "AI summaries & action items",
    description: "Decisions, owners, and next steps extracted the moment the call ends.",
    span: "lg:col-span-3",
  },
  {
    icon: <ChatIcon />,
    title: "Chat with your meetings",
    description: 'Ask "what did we decide about pricing?" and get the answer with the exact moment cited.',
    span: "lg:col-span-2",
  },
  {
    icon: <DesktopIcon />,
    title: "Botless desktop capture",
    description: "Record straight from your machine — no awkward bot in the room.",
    span: "lg:col-span-2",
  },
  {
    icon: <PlugIcon />,
    title: "Integrations",
    description: "Push notes to Slack, Notion, and your CRM automatically.",
    span: "lg:col-span-2",
  },
];

export function FeatureBento() {
  return (
    <section id="features" aria-labelledby="features-heading" className="bg-surface-0">
      <div className="mx-auto max-w-[1180px] px-5 py-20 sm:px-8 lg:py-28">
        <div className="max-w-2xl">
          <Reveal>
            <p className="eyebrow mb-4">Everything in one place</p>
          </Reveal>
          <Reveal delay={60}>
            <h2 id="features-heading" className="text-2xl text-ink">
              The whole meeting, working for you
            </h2>
          </Reveal>
          <Reveal delay={120}>
            <p className="mt-4 text-lg leading-relaxed text-ink-soft">
              Not just a recorder. Parlor listens, organizes, and answers — so
              the work that usually happens after the call mostly happens on its
              own.
            </p>
          </Reveal>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {FEATURES.map((feature, index) => (
            <Reveal
              key={feature.title}
              delay={index * 70}
              className={feature.span}
            >
              <BentoTile feature={feature} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

type TileProps = {
  feature: Feature;
};

function BentoTile({ feature }: TileProps) {
  return (
    <article className="shadow-soft-md group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border-subtle bg-surface-0 p-6 transition-[box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:shadow-soft-lg sm:p-7">
      {feature.hasGoldWash ? (
        <span aria-hidden="true" className="wash-gold pointer-events-none absolute inset-0" />
      ) : null}

      <span className="relative flex h-11 w-11 items-center justify-center rounded-lg bg-sage-50 text-sage-600 transition-colors duration-300 group-hover:bg-sage-100">
        {feature.icon}
      </span>

      <h3 className="relative mt-5 text-xl leading-tight text-ink">
        {feature.title}
      </h3>
      <p className="relative mt-2 text-base leading-relaxed text-ink-soft">
        {feature.description}
      </p>
    </article>
  );
}
