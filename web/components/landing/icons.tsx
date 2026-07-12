import type { SVGProps } from "react";

/**
 * Inline, decorative SVG icons. They inherit `currentColor` and are
 * marked aria-hidden — they sit beside text labels, never alone.
 */
type IconProps = SVGProps<SVGSVGElement>;

function base(props: IconProps) {
  return {
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    focusable: false,
    ...props,
  };
}

export function CalendarIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
      <path d="M3 9h18M8 2.5v4M16 2.5v4" />
      <path d="m9.5 14.5 1.8 1.8 3.4-3.6" />
    </svg>
  );
}

export function WaveformIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 12v0M7.5 8v8M11 5v14M14.5 8.5v7M18 11v2M20.5 12v0" />
    </svg>
  );
}

export function SparkIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3.5c.4 3.6 1.9 5.1 5.5 5.5-3.6.4-5.1 1.9-5.5 5.5-.4-3.6-1.9-5.1-5.5-5.5 3.6-.4 5.1-1.9 5.5-5.5Z" />
      <path d="M18.5 14.5c.2 1.6.9 2.3 2.5 2.5-1.6.2-2.3.9-2.5 2.5-.2-1.6-.9-2.3-2.5-2.5 1.6-.2 2.3-.9 2.5-2.5Z" />
    </svg>
  );
}

export function ChatIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H9l-4 3.5v-3.5H6.5" />
      <path d="M8.5 9h7M8.5 12h4" />
    </svg>
  );
}

export function DesktopIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="4.5" width="18" height="12" rx="2" />
      <path d="M8.5 20.5h7M12 16.5v4" />
      <circle cx="12" cy="10.5" r="2.4" />
    </svg>
  );
}

export function PlugIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M9 3.5v4M15 3.5v4" />
      <path d="M6.5 7.5h11v3a5.5 5.5 0 0 1-11 0v-3Z" />
      <path d="M12 16v4.5" />
    </svg>
  );
}

export function PlayIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="m10 8.5 6 3.5-6 3.5v-7Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ArrowIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function BracketsIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M9 4.5 4.5 12 9 19.5M15 4.5l4.5 7.5-4.5 7.5" />
    </svg>
  );
}

export function WebhookIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6.5 17a3.5 3.5 0 1 1 3-5.3" />
      <path d="M10.5 8.5 14 15" />
      <circle cx="15.5" cy="16.5" r="3" />
      <circle cx="16" cy="7" r="2.2" />
      <path d="M14.2 8.7 11.3 12" />
    </svg>
  );
}

export function AgentIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="4.5" y="8" width="15" height="11" rx="3" />
      <path d="M12 8V4.5M9 3.5h6" />
      <circle cx="9" cy="13" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="13" r="1.1" fill="currentColor" stroke="none" />
      <path d="M9.5 16.5h5" />
    </svg>
  );
}
