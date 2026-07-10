import Link from "next/link";
import Image from "next/image";

type Props = {
  href?: string;
  className?: string;
};

/**
 * Shared "Parlor" brand mark used in the app shell, its offline fallback,
 * and the marketing site nav. Sizes off the --text-lg fluid clamp token so
 * it scales consistently instead of a hand-copied fixed rem value.
 */
export function Wordmark({ href = "/dashboard", className = "" }: Props) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 font-display text-lg font-medium tracking-tight text-ink ${className}`}
    >
      <Image src="/logo.svg" alt="" width={28} height={28} className="shrink-0" priority />
      Parlor
    </Link>
  );
}
