import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { cx } from "./cx";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors select-none whitespace-nowrap";
const variants: Record<Variant, string> = {
  primary: "bg-eko-accent text-eko-on-accent hover:bg-eko-accent/90",
  secondary: "bg-eko-surface text-eko-ink ring-1 ring-inset ring-eko-line hover:bg-eko-sunken",
  ghost: "text-eko-ink hover:bg-eko-sunken",
  danger: "bg-eko-danger-soft text-eko-danger hover:bg-eko-danger/15",
};
const sizes: Record<Size, string> = {
  sm: "min-h-9 px-3 text-sm",
  md: "min-h-11 px-4 text-[15px]",
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
    <button type={type} className={buttonClass(variant, size, className)} {...rest}>
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
      className={cx("inline-flex size-11 items-center justify-center rounded-xl text-eko-muted hover:bg-eko-sunken hover:text-eko-ink", className)}
      {...rest}
    >
      {children}
    </button>
  );
}
