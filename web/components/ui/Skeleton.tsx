type Props = {
  className?: string;
};

/** Shimmering placeholder block on a warm surface tint. */
export function Skeleton({ className = "" }: Props) {
  return (
    <span
      aria-hidden="true"
      className={`block animate-pulse rounded-md bg-surface-2 ${className}`}
    />
  );
}
