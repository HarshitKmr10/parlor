import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

type Props = {
  variant?: Variant;
  size?: Size;
} & ButtonHTMLAttributes<HTMLButtonElement>;

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-sage-600 text-surface-cream shadow-soft-sm hover:bg-sage-700 active:translate-y-px",
  secondary:
    "border border-border-default bg-surface-0 text-ink hover:border-border-strong hover:bg-surface-1 active:translate-y-px",
  ghost: "text-ink-soft hover:bg-surface-1 hover:text-ink",
  danger:
    "border border-border-default bg-surface-0 text-error hover:bg-error-bg active:translate-y-px",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2.5 text-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  children,
  ...rest
}: Props) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-md font-sans font-medium transition-[background-color,border-color,transform,box-shadow] duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
