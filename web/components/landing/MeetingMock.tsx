import { SparkIcon } from "./icons";

type Speaker = {
  initials: string;
  name: string;
  isActive?: boolean;
};

type TranscriptLine = {
  time: string;
  speaker: string;
  text: string;
};

const SPEAKERS: Speaker[] = [
  { initials: "MR", name: "Maya Reyes", isActive: true },
  { initials: "JL", name: "Jonah Lin" },
  { initials: "AK", name: "Amara Okafor" },
  { initials: "DS", name: "Dev Shah" },
];

const TRANSCRIPT: TranscriptLine[] = [
  { time: "00:12", speaker: "Maya", text: "Let's lock the Q3 roadmap before we ship the beta." },
  { time: "00:19", speaker: "Jonah", text: "Onboarding flow is the blocker — I'll own it this week." },
  { time: "00:27", speaker: "Amara", text: "I can pair on the activation metrics by Thursday." },
];

/**
 * Stylized, static "live meeting" card. Purely presentational —
 * built from divs/CSS, no real data. Decorative to assistive tech.
 */
export function MeetingMock() {
  return (
    <div aria-hidden="true" className="relative">
      {/* Floating AI-summary chip, overlapping the card corner for depth */}
      <div className="absolute -right-3 -top-5 z-20 hidden sm:block">
        <div className="flex items-center gap-2 rounded-full border border-border-subtle bg-surface-0 px-3.5 py-2 shadow-soft-md">
          <SparkIcon className="h-4 w-4 text-gold-700" width={16} height={16} />
          <span className="font-mono text-xs tracking-tight text-ink-soft">AI summary ready</span>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-border-subtle bg-surface-0 shadow-soft-xl">
        {/* Window chrome */}
        <div className="flex items-center justify-between border-b border-border-subtle px-5 py-3.5">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-surface-3" />
            <span className="h-2.5 w-2.5 rounded-full bg-surface-3" />
            <span className="h-2.5 w-2.5 rounded-full bg-surface-3" />
          </div>
          <span className="font-mono text-xs text-ink-muted">parlor.live</span>
          <span className="flex items-center gap-1.5 rounded-full bg-error-bg px-2.5 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-error" />
            <span className="font-mono text-xs font-medium tracking-wide text-error">REC</span>
          </span>
        </div>

        {/* Speaker grid */}
        <div className="grid grid-cols-4 gap-3 px-5 pb-1 pt-5">
          {SPEAKERS.map((speaker) => (
            <div key={speaker.initials} className="flex flex-col items-center gap-2">
              <div
                className={
                  speaker.isActive
                    ? "glow-gold flex h-12 w-12 items-center justify-center rounded-full bg-sage-100 ring-2 ring-gold-400"
                    : "flex h-12 w-12 items-center justify-center rounded-full bg-sage-50"
                }
              >
                <span className="font-mono text-sm font-medium text-sage-700">{speaker.initials}</span>
              </div>
              <span className="max-w-full truncate text-xs text-ink-muted">
                {speaker.name.split(" ")[0]}
              </span>
            </div>
          ))}
        </div>

        <hr className="mx-5 my-4 border-border-subtle" />

        {/* Live transcript */}
        <div className="space-y-3.5 px-5 pb-3">
          <div className="flex items-center gap-2">
            <WaveBars />
            <span className="font-mono text-xs uppercase tracking-wider text-ink-faint">
              Live transcript
            </span>
          </div>
          {TRANSCRIPT.map((line) => (
            <div key={line.time} className="flex gap-3">
              <span className="mt-0.5 shrink-0 font-mono text-xs text-ink-faint">{line.time}</span>
              <p className="text-sm leading-snug text-ink">
                <span className="font-medium text-sage-700">{line.speaker}:</span> {line.text}
              </p>
            </div>
          ))}
        </div>

        {/* Action-item footer */}
        <div className="mt-1 border-t border-border-subtle bg-surface-1 px-5 py-4">
          <p className="mb-2 font-mono text-xs uppercase tracking-wider text-ink-faint">
            Captured action items
          </p>
          <ul className="space-y-1.5">
            <li className="flex items-start gap-2 text-sm text-ink-soft">
              <Check /> Jonah owns onboarding flow — due Friday
            </li>
            <li className="flex items-start gap-2 text-sm text-ink-soft">
              <Check /> Amara to pair on activation metrics by Thursday
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function WaveBars() {
  const heights = [6, 11, 8, 13, 7];
  return (
    <span className="flex items-end gap-[3px]">
      {heights.map((h, i) => (
        <span
          key={i}
          className="w-[3px] rounded-full bg-sage-400"
          style={{ height: `${h}px` }}
        />
      ))}
    </span>
  );
}

function Check() {
  return (
    <svg
      className="mt-0.5 h-4 w-4 shrink-0 text-sage-500"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="m5 8 2 2 4-4.2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
