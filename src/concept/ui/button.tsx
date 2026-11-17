import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { cx } from "./cx";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

// One primary per screen; everything else is secondary or ghost. Every size
// keeps the 44 px touch target. Disabled looks are set in studio.css. Labels
// stay on one line, except on very narrow screens (200 % zoom on a phone),
// where they wrap instead of pushing the page sideways.
const base =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors select-none whitespace-nowrap max-[299px]:max-w-full max-[299px]:whitespace-normal max-[299px]:text-center max-[299px]:py-2";
const variants: Record<Variant, string> = {
  primary: "bg-action text-on-action hover:bg-action-hover active:bg-action-hover",
  secondary: "bg-surface text-text ring-1 ring-inset ring-input-border hover:bg-surface-2 active:bg-surface-2",
  ghost: "text-text hover:bg-surface-2 active:bg-surface-2",
  danger: "bg-danger-bg text-danger ring-1 ring-inset ring-danger/40 hover:ring-danger active:ring-danger",
};
const sizes: Record<Size, string> = {
  sm: "min-h-11 px-3 text-[15px]",
  md: "min-h-11 px-4 text-base",
  lg: "min-h-12 px-5 text-base",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cx(base, variants[variant], sizes[size], className);
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
}

export function Button({ variant, size, icon, className, children, type = "button", ...rest }: ButtonProps) {
  return (
    <button type={type} data-tone={variant === "danger" ? "danger" : undefined} className={buttonClass(variant, size, className)} {...rest}>
      {icon}
      {children}
    </button>
  );
}

interface ButtonLinkProps {
  href: string;
  /** Name for the Help button's "Show me". */
  help?: string;
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function ButtonLink({ href, help, variant, size, icon, className, children }: ButtonLinkProps) {
  return (
    <Link href={href} data-help={help} className={buttonClass(variant, size, className)}>
      {icon}
      {children}
    </Link>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children: ReactNode;
}

export function IconButton({ label, className, children, type = "button", ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cx("inline-flex size-11 items-center justify-center rounded-md text-text-secondary hover:bg-surface-2 hover:text-text active:bg-surface-2", className)}
      {...rest}
    >
      {children}
    </button>
  );
}
