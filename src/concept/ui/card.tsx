import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

// `ui-card` marks a drawn card: the booking page's section styles (tenant-theme.css) restyle it.
const surfaces = {
  /** A plain paper surface on the canvas: the default for lists and forms. No outline. */
  paper: "ui-card rounded-lg bg-surface",
  /** The one surface a screen is about: lifted off the canvas, no outline. */
  raised: "ui-card studio-raised rounded-lg bg-surface",
  /** Content that sits straight on the canvas: no box and no rules, set apart by space alone. */
  flat: "",
};

export function Card({ className, surface = "paper", ...rest }: HTMLAttributes<HTMLDivElement> & { surface?: keyof typeof surfaces }) {
  return <div className={cx(surfaces[surface], className)} {...rest} />;
}

interface SectionProps {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** A titled block on a page. */
export function Section({ title, action, children, className }: SectionProps) {
  return (
    <section className={cx("space-y-3", className)}>
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2 className="min-w-0 break-words text-h3 font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Stat({ label, value }: { label: string; value: string }) {
  return <dl><dt className="text-meta text-text-secondary">{label}</dt><dd className="text-h2 font-semibold">{value}</dd></dl>;
}
