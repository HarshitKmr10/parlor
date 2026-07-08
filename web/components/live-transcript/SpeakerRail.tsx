"use client";

import type { Speaker } from "./types";
import { tintBg } from "./utils";

type Props = {
  speakers: Speaker[];
  activeSpeakerId: string | null;
  /**
   * Talk time per speaker id, in seconds. Used to render the relative
   * talk-time meter. Missing ids render as zero.
   */
  talkTimeSec: Record<string, number>;
};

export function SpeakerRail({ speakers, activeSpeakerId, talkTimeSec }: Props) {
  const maxTalk = Math.max(1, ...speakers.map((s) => talkTimeSec[s.id] ?? 0));

  return (
    <>
      {/* Pulse keyframe scoped to this surface; gated by reduced-motion. */}
      <style>{`
        @keyframes parlor-speaker-pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        .parlor-active-glow {
          animation: parlor-speaker-pulse 1.4s var(--ease-in-out, ease-in-out) infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .parlor-active-glow { animation: none; opacity: 1; }
        }
      `}</style>

      <ul
        aria-label="Meeting participants"
        className="flex flex-row gap-3 overflow-x-auto px-1 py-2 lg:flex-col lg:gap-4 lg:overflow-visible lg:px-0"
      >
        {speakers.map((speaker) => {
          const isActive = speaker.id === activeSpeakerId;
          const talk = talkTimeSec[speaker.id] ?? 0;
          const meterPct = Math.round((talk / maxTalk) * 100);

          return (
            <li
              key={speaker.id}
              className="flex shrink-0 flex-col items-center gap-1.5 lg:w-full lg:flex-row lg:items-center lg:gap-3"
              aria-label={`${speaker.name}${isActive ? ", speaking now" : ""}`}
              aria-current={isActive ? "true" : undefined}
            >
              {/* Avatar with active brass ring + pulsing glow */}
              <div className="relative shrink-0">
                <span
                  aria-hidden="true"
                  className={[
                    "grid h-11 w-11 place-items-center rounded-full font-sans text-sm font-semibold text-surface-cream transition-transform duration-300",
                    tintBg(speaker.sageTint),
                    isActive ? "scale-105" : "scale-100",
                  ].join(" ")}
                  style={{ transitionTimingFunction: "var(--ease-out-soft)" }}
                >
                  {speaker.initials}
                </span>
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="parlor-active-glow glow-gold pointer-events-none absolute -inset-0.5 rounded-full"
                  />
                )}
              </div>

              <div className="hidden min-w-0 flex-1 lg:block">
                <p className="truncate text-sm font-medium text-ink">
                  {speaker.name}
                </p>
                {/* Thin sage talk-time meter */}
                <div className="mt-1 flex items-center gap-2">
                  <span
                    className="h-1 flex-1 overflow-hidden rounded-full bg-surface-2"
                    role="img"
                    aria-label={`Talk time ${meterPct}% of the most active speaker`}
                  >
                    <span
                      className={`block h-full rounded-full ${tintBg(speaker.sageTint)} origin-left transition-transform duration-500`}
                      style={{
                        transform: `scaleX(${meterPct / 100})`,
                        transitionTimingFunction: "var(--ease-out-soft)",
                      }}
                    />
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
