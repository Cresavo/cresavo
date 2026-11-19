import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import Link from "next/link";
import { cx } from "./cx";

type Variant = "primary" | "secondary" | "tertiary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";
type Align = "center" | "start" | "between";
type Width = "responsive";

const responsiveWidth = "w-full sm:w-fit";

// The ghost spelling remains available for existing callers.
const base =
  "ui-press inline-flex min-h-target min-w-target max-w-full items-center gap-2 rounded-md font-medium select-none [overflow-wrap:anywhere]";
const alignment: Record<Align, string> = {
  center: "justify-center text-center",
  start: "justify-start text-left",
  between: "justify-between text-left",
};
const variants: Record<Variant, string> = {
  primary: "bg-action text-on-action hover:bg-action-hover active:bg-action-hover",
  secondary: "bg-surface text-text ring-1 ring-inset ring-input-border hover:bg-surface-2 active:bg-surface-2",
  tertiary: "text-text hover:bg-surface-2 active:bg-surface-2",
  ghost: "text-text hover:bg-surface-2 active:bg-surface-2",
  danger: "bg-surface text-danger ring-1 ring-inset ring-danger hover:bg-surface-2 active:bg-surface-2",
};
const sizes: Record<Size, string> = {
  sm: "px-3 py-1 text-body",
  md: "px-4 py-2 text-body",
  lg: "min-h-12 px-6 py-2 text-h3",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string, align: Align = "center") {
  return cx(base, alignment[align], variants[variant], sizes[size], className);
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  ref?: Ref<HTMLButtonElement>;
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  align?: Align;
  width?: Width;
}

export function Button({ variant, size, icon, className, children, loading, disabled, type = "button", align, width, ...rest }: ButtonProps) {
  return (
    <button type={type} data-tone={variant === "danger" ? "danger" : undefined} className={buttonClass(variant, size, cx(width && responsiveWidth, className), align)} {...rest} disabled={disabled || loading} aria-busy={loading || rest["aria-busy"]}>
      {loading ? <LoadingMark /> : icon}
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
  width?: Width;
  children: ReactNode;
}

export function ButtonLink({ href, help, variant, size, icon, className, children, width }: ButtonLinkProps) {
  return (
    <Link href={href} data-help={help} className={buttonClass(variant, size, cx(width && responsiveWidth, className))}>
      {icon}
      {children}
    </Link>
  );
}

function LoadingMark() {
  return <span aria-hidden="true" className="ui-spinner size-4 shrink-0 rounded-full border-2 border-current border-r-transparent" />;
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  variant?: Variant;
  children: ReactNode;
  loading?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

export function IconButton({ label, variant = "tertiary", loading, disabled, className, children, type = "button", ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      data-tone={variant === "danger" ? "danger" : undefined}
      className={cx(base, alignment.center, variants[variant], "size-target shrink-0", className)}
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || rest["aria-busy"]}
    >
      {loading ? <LoadingMark /> : children}
    </button>
  );
}
